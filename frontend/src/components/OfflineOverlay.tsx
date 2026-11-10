/**
 * Full-screen, borderless "offline" page mounted above every screen.
 *
 *  - No internet (NetInfo)            → "Connect to plan your celebration"
 *  - Internet OK, Thara server down   → "We'll be right back"
 *
 * Debounced (~1.5s) so brief blips never flash; probes the server every ~5s
 * while showing and dismisses itself on recovery with a fading "Back online"
 * eyebrow, then emits a reconnect event so screens refetch. Sits *below* the
 * celebration layer (rendered inside CelebrationProvider, before its burst).
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import Animated, { Easing, FadeIn, FadeOut, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { brandGold, fonts } from "../theme";
import { TharaLogo } from "./TharaLogo";
import { GoldGlow } from "./ui";
import { probeServer } from "../api";
import { emitReconnect, isServerDown, subscribeServerState } from "../connectivity";

type Issue = "offline" | "server";

const SHOW_DELAY = 1500;      // don't flash on brief blips
const SWITCH_DELAY = 2000;    // offline ↔ server copy changes settle first
const PROBE_EVERY = 5000;
const TOAST_MS = 2200;

const COPY: Record<Issue, { eyebrow: string; title: string; body: string; icon: keyof typeof Ionicons.glyphMap }> = {
  offline: {
    eyebrow: "No connection",
    title: "Connect to plan your celebration",
    body: "You\u2019re offline. Reconnect to Wi\u2011Fi or mobile data and we\u2019ll pick up right where you left off.",
    icon: "cloud-offline-outline",
  },
  server: {
    eyebrow: "A short pause",
    title: "We\u2019ll be right back",
    body: "Thara is taking a short pause. Your plans are safe \u2014 try again in a moment.",
    icon: "sparkles-outline",
  },
};

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduce(!!v));
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduce;
}

/** Two soft gold rings breathing outward around an icon. Static when reduce-motion is on. */
function PulseRing({ gold, icon, reduce }: { gold: string; icon: keyof typeof Ionicons.glyphMap; reduce: boolean }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (reduce) { a.set(0.5); b.set(0); breathe.set(1); return; }
    const loop = (d = 0) => withDelay(d, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false));
    a.set(loop(0));
    b.set(loop(1300));
    breathe.set(withRepeat(withTiming(1.06, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => { cancelAnimation(a); cancelAnimation(b); cancelAnimation(breathe); };
  }, [reduce, a, b, breathe]);
  const ring = (v: typeof a) => ({ transform: [{ scale: 0.7 + v.get() * 0.65 }], opacity: (1 - v.get()) * 0.55 });
  const sa = useAnimatedStyle(() => ring(a));
  const sb = useAnimatedStyle(() => ring(b));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: breathe.get() }] }));
  const R = 92;
  return (
    <View style={{ width: 170, height: 170, alignItems: "center", justifyContent: "center" }}>
      <GoldGlow size={240} />
      <Animated.View style={[{ position: "absolute", width: R, height: R, borderRadius: R / 2, borderWidth: 1, borderColor: gold }, sa]} />
      <Animated.View style={[{ position: "absolute", width: R, height: R, borderRadius: R / 2, borderWidth: 1, borderColor: gold }, sb]} />
      <Animated.View style={core}>
        <Ionicons name={icon} size={38} color={gold} />
      </Animated.View>
    </View>
  );
}

export function OfflineOverlay() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const gold = isDark ? brandGold.dark : brandGold.light;
  const onGold = isDark ? colors.onBrand : "#FBF6EC"; // ivory on antique gold reads cleaner in light mode

  const serverDown = useSyncExternalStore(subscribeServerState, isServerDown, isServerDown);
  const [net, setNet] = useState<{ connected: boolean | null; reachable: boolean | null }>({ connected: null, reachable: null });
  const [unreachConfirmed, setUnreachConfirmed] = useState(false);
  const [shown, setShown] = useState<Issue | null>(null);
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState(0);
  const shownRef = useRef<Issue | null>(null);
  useEffect(() => { shownRef.current = shown; }, [shown]);

  // NetInfo: "offline" only when the OS says so, or reachability fails AND our own probe fails too
  // (avoids false positives from captive/blocked reachability checks).
  useEffect(() => {
    const apply = (s: NetInfoState) => setNet({ connected: s.isConnected, reachable: s.isInternetReachable ?? null });
    NetInfo.fetch().then(apply).catch(() => {});
    return NetInfo.addEventListener(apply);
  }, []);

  useEffect(() => {
    if (net.reachable !== false || net.connected === false) return;
    let alive = true;
    probeServer().then((up) => { if (alive) setUnreachConfirmed(!up); });
    return () => { alive = false; };
  }, [net.reachable, net.connected]);

  // As soon as the OS reports a connection again, check the server right away.
  const prevConnected = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevConnected.current === false && net.connected) probeServer();
    prevConnected.current = net.connected;
  }, [net.connected]);

  const raw: Issue | null =
    net.connected === false ? "offline"
    : serverDown ? (net.reachable === false ? "offline" : "server")
    : net.reachable === false && unreachConfirmed ? "offline"
    : null;

  // Any recovery (even one shorter than the show debounce) lets screens refetch.
  const prevRaw = useRef<Issue | null>(null);
  useEffect(() => {
    if (prevRaw.current && !raw) emitReconnect();
    prevRaw.current = raw;
  }, [raw]);

  // Debounce showing / switching; hide immediately on recovery.
  useEffect(() => {
    if (raw === shownRef.current) return;
    if (raw === null) {
      if (shownRef.current) { setShown(null); setToast(Date.now()); }
      return;
    }
    const t = setTimeout(() => setShown(raw), shownRef.current ? SWITCH_DELAY : SHOW_DELAY);
    return () => clearTimeout(t);
  }, [raw]);

  // Probe every ~5s while there is an issue.
  useEffect(() => {
    if (!raw) return;
    const id = setInterval(() => { probeServer(); NetInfo.refresh().catch(() => {}); }, PROBE_EVERY);
    return () => clearInterval(id);
  }, [raw]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(0), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const tryAgain = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    const started = Date.now();
    try {
      const s = await NetInfo.refresh().catch(() => null);
      if (s) setNet({ connected: s.isConnected, reachable: s.isInternetReachable ?? null });
      const up = s?.isConnected === false ? false : await probeServer();
      if (up) setUnreachConfirmed(false);
    } finally {
      const wait = Math.max(0, 700 - (Date.now() - started));
      setTimeout(() => setChecking(false), wait);
    }
  }, [checking]);

  const copy = shown ? COPY[shown] : null;

  return (
    <>
      {copy ? (
        <Animated.View
          key="thara-offline"
          entering={FadeIn.duration(reduce ? 160 : 380)}
          exiting={FadeOut.duration(reduce ? 160 : 320)}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, zIndex: 50, elevation: 50 }]}
          accessibilityViewIsModal
          testID="offline-overlay"
        >
          <View style={[styles.page, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}>
            <TharaLogo variant="wordmark" size={28} />
            <View style={styles.center}>
              <PulseRing gold={gold} icon={copy.icon} reduce={reduce} />
              <Text style={[styles.eyebrow, { color: gold }]} accessibilityRole="text">{copy.eyebrow.toUpperCase()}</Text>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header" testID="offline-title">{copy.title}</Text>
              <View style={[styles.rule, { backgroundColor: gold }]} />
              <Text style={[styles.body, { color: colors.textMuted }]} accessibilityLiveRegion="polite">{copy.body}</Text>
            </View>
            <Pressable
              testID="offline-retry"
              onPress={tryAgain}
              disabled={checking}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              accessibilityState={{ busy: checking }}
              style={({ pressed }) => [styles.pill, { backgroundColor: gold }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            >
              {checking ? <ActivityIndicator size="small" color={onGold} /> : <Ionicons name="refresh" size={16} color={onGold} />}
              <Text style={[styles.pillText, { color: onGold }]}>{checking ? "Checking\u2026" : "Try again"}</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {toast && !copy ? (
        <Animated.View
          key={`back-${toast}`}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(420)}
          pointerEvents="none"
          style={[styles.toast, { top: insets.top + 8 }]}
          testID="back-online-toast"
        >
          <View style={[styles.toastInner, { backgroundColor: isDark ? "rgba(12,12,12,0.86)" : "rgba(251,246,236,0.94)" }]}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={[styles.toastText, { color: gold }]}>BACK ONLINE</Text>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32 },
  center: { alignItems: "center", width: "100%" },
  eyebrow: { marginTop: 18, fontSize: 11, fontWeight: "700", letterSpacing: 2.6 },
  title: { marginTop: 10, fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 40, textAlign: "center" },
  rule: { width: 40, height: StyleSheet.hairlineWidth * 2, marginTop: 18, opacity: 0.7 },
  body: { marginTop: 16, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, minWidth: 200, paddingHorizontal: 28, borderRadius: 999 },
  pillText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.4 },
  toast: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 60, elevation: 60 },
  toastInner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  toastText: { fontSize: 11, fontWeight: "700", letterSpacing: 2.2 },
});
