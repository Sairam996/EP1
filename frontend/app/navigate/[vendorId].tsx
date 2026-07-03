import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { buildNavMapHtml } from "@/src/components/NavMapHtml";
import { NavMapHost, type NavMapHostHandle } from "@/src/components/NavMapHost";

type Step = { text: string; distance: number; type?: string; modifier?: string | null };

function formatDistance(m: number) {
  if (m < 950) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
function formatDuration(s: number) {
  if (s < 60) return `${Math.round(s)} s`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${h}h ${rem}m`;
}
function iconForStep(step?: Step): keyof typeof Ionicons.glyphMap {
  if (!step) return "navigate";
  const t = step.type || "";
  const m = step.modifier || "";
  if (t === "arrive") return "flag";
  if (t === "depart") return "navigate";
  if (t === "roundabout" || t === "rotary") return "sync";
  if (t === "merge") return "git-merge";
  if (m.includes("left")) return m.includes("slight") ? "arrow-back" : "arrow-undo";
  if (m.includes("right")) return m.includes("slight") ? "arrow-forward" : "arrow-redo";
  if (m.includes("straight")) return "arrow-up";
  return "navigate";
}

export default function NavigateScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const insets = useSafeAreaInsets();
  const webRef = useRef<NavMapHostHandle>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const [vendor, setVendor] = useState<any>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<"loading" | "granted" | "denied" | "unsupported">("loading");
  const [route, setRoute] = useState<{ distance: number; duration: number; steps: Step[] } | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Fetch vendor
  useEffect(() => {
    (async () => {
      try {
        const v = await api.get(`/vendors/${vendorId}`, { auth: false });
        setVendor(v);
      } catch {
        Alert.alert("Vendor not found");
        router.back();
      }
    })();
  }, [vendorId]);

  // Location permission + subscription
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === "web") {
          if (!("geolocation" in navigator)) {
            setPermission("unsupported");
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (p) => {
              if (cancelled) return;
              setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
              setPermission("granted");
            },
            () => setPermission("denied"),
            { enableHighAccuracy: true, timeout: 10000 }
          );
          const wid = navigator.geolocation.watchPosition(
            (p) => setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
          return () => navigator.geolocation.clearWatch(wid);
        }
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPermission("denied");
          if (!canAskAgain) {
            Alert.alert("Location required", "Enable location in Settings to use in-app navigation.", [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]);
          }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        if (cancelled) return;
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermission("granted");
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 },
          (p) => setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
        );
      } catch {
        if (!cancelled) setPermission("denied");
      }
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, []);

  // Push user updates into WebView
  useEffect(() => {
    if (!ready || !userCoords) return;
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
        JSON.stringify({ type: "user", lat: userCoords.lat, lng: userCoords.lng })
      )} })); true;`
    );
  }, [userCoords, ready]);

  const html = useMemo(() => {
    if (!vendor) return "";
    return buildNavMapHtml({
      destLat: vendor.lat,
      destLng: vendor.lng,
      destName: vendor.name,
      initialLat: userCoords?.lat,
      initialLng: userCoords?.lng,
      brand: colors.brand,
    });
  }, [vendor, ready]); // rebuild on ready flip so initial coords land

  const handleMessage = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "ready") {
        setReady(true);
      } else if (parsed.type === "route") {
        setRoute({ distance: parsed.distance, duration: parsed.duration, steps: parsed.steps || [] });
        setCurrentStepIdx(0);
      }
    } catch {}
  };

  const recenter = () => {
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
        JSON.stringify({ type: "recenter" })
      )} })); true;`
    );
  };
  const focusUser = () => {
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
        JSON.stringify({ type: "focusUser" })
      )} })); true;`
    );
  };

  const openExternal = () => {
    if (!vendor) return;
    const dest = `${vendor.lat},${vendor.lng}`;
    const label = encodeURIComponent(vendor.name);
    const url =
      Platform.OS === "ios"
        ? `https://maps.apple.com/?daddr=${dest}&dirflg=d&q=${label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}&destination_place_id=${label}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
  };

  if (!vendor) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const nextStep: Step | undefined = route?.steps[currentStepIdx];
  const upcomingStep: Step | undefined = route?.steps[currentStepIdx + 1];

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapWrap}>
        {permission === "loading" && (
          <View style={styles.overlay}><ActivityIndicator color={colors.brand} /><Text style={styles.overlayText}>Locating you…</Text></View>
        )}
        {permission === "denied" && (
          <View style={styles.overlay}>
            <Ionicons name="location-outline" size={40} color={colors.textMuted} />
            <Text style={styles.overlayText}>Location permission is required for live navigation.</Text>
            <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsBtnText}>Open Settings</Text>
            </Pressable>
          </View>
        )}
        {permission === "granted" && html !== "" && (
          <NavMapHost
            testID="nav-webview"
            ref={webRef}
            html={html}
            onMessage={handleMessage}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* Top instruction card */}
      <View style={[styles.topCard, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="nav-back">
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          {nextStep ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.stepIcon}>
                  <Ionicons name={iconForStep(nextStep)} size={22} color={colors.onBrand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepText} numberOfLines={2}>{nextStep.text}</Text>
                  <Text style={styles.stepDist}>{formatDistance(nextStep.distance)}</Text>
                </View>
              </View>
              {upcomingStep && (
                <View style={styles.thenRow}>
                  <Ionicons name="return-down-forward" size={13} color={colors.textMuted} />
                  <Text style={styles.thenText} numberOfLines={1}>Then: {upcomingStep.text}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.stepText}>Calculating route…</Text>
          )}
        </View>
        <Pressable onPress={() => setMuted((m) => !m)} style={styles.iconBtn} testID="nav-mute">
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Floating action buttons */}
      <View style={[styles.fabColumn, { bottom: 140 + insets.bottom }]}>
        <Pressable style={styles.fab} onPress={recenter} testID="nav-recenter">
          <Ionicons name="expand-outline" size={20} color={colors.brand} />
        </Pressable>
        <Pressable style={styles.fab} onPress={focusUser} testID="nav-locate">
          <Ionicons name="locate" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {/* Bottom summary */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
            <Text style={styles.vendorAddr} numberOfLines={1}>{vendor.address || vendor.city}</Text>
          </View>
          {route && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.eta}>{formatDuration(route.duration)}</Text>
              <Text style={styles.etaDist}>{formatDistance(route.distance)}</Text>
            </View>
          )}
        </View>
        <View style={styles.actionRow}>
          <Pressable style={[styles.action, styles.actionSecondary]} onPress={() => router.push(`/vendor/${vendor.id}` as any)} testID="nav-details">
            <Ionicons name="information-circle-outline" size={18} color={colors.text} />
            <Text style={styles.actionSecondaryText}>Details</Text>
          </Pressable>
          <Pressable style={[styles.action, styles.actionPrimary]} onPress={openExternal} testID="nav-open-external">
            <Ionicons name="navigate" size={18} color={colors.onBrand} />
            <Text style={styles.actionPrimaryText}>Start turn-by-turn</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  mapWrap: { flex: 1, backgroundColor: colors.surface2 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlayText: { color: colors.textSubtle, textAlign: "center", maxWidth: 300 },
  settingsBtn: { marginTop: spacing.md, backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  settingsBtnText: { color: colors.onBrand, fontWeight: "700" },
  topCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    backgroundColor: "rgba(11,12,16,0.94)",
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  stepIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
  },
  stepText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  stepDist: { color: colors.brand, fontSize: 12, marginTop: 2, fontWeight: "600" },
  thenRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border },
  thenText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  fabColumn: { position: "absolute", right: spacing.md, gap: spacing.sm },
  fab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(11,12,16,0.92)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  bottomCard: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    borderTopWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  vendorName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  vendorAddr: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  eta: { color: colors.brand, fontSize: 20, fontWeight: "700" },
  etaDist: { color: colors.textSubtle, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  action: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: radius.pill,
  },
  actionSecondary: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  actionSecondaryText: { color: colors.text, fontWeight: "600" },
  actionPrimary: { backgroundColor: colors.brand },
  actionPrimaryText: { color: colors.onBrand, fontWeight: "700" },
});
