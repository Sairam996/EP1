import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, radius, spacing, themedStyles } from "@/src/theme";

const STEPS = [
  { key: "description", label: "Describe your business", route: "/vendor-profile-edit" },
  { key: "cover", label: "Upload a cover photo", route: "/vendor-profile-edit" },
  { key: "photos", label: "Add 3+ gallery photos", route: "/vendor-profile-edit" },
  { key: "event_types", label: "Pick event types you serve", route: "/vendor-profile-edit" },
  { key: "services", label: "Add at least one package", route: "/vendor-services" },
  { key: "availability", label: "Set your availability", route: "/vendor-availability" },
  { key: "kyc", label: "Get KYC verified", route: "/kyc" },
];

function formatINRShort(n: number): string {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(1)}L`;
  if (v >= 1000) return `₹${+(v / 1000).toFixed(1)}k`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.get("/vendor/dashboard")); }
    catch (e) { console.warn(e); }
    finally { setRefresh(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  const comp = data.completeness || { percent: 0, checks: {}, listable: false };
  const ks: string = data.kyc_status || (data.verified ? "approved" : "not_submitted");
  const kyc = {
    approved: { label: "Verified", sub: "Gold Verified badge is on your listing", icon: "shield-checkmark", color: colors.success },
    pending: { label: "Under review", sub: "Our Hyderabad team is reviewing your documents (1–2 days)", icon: "time", color: colors.warning },
    rejected: { label: "Needs attention", sub: "Please re-submit your KYC details", icon: "close-circle", color: colors.error },
    not_submitted: { label: "Not submitted", sub: "Submit KYC to get verified and go live", icon: "alert-circle", color: colors.warning },
  }[ks] || { label: ks, sub: "", icon: "alert-circle", color: colors.warning };

  const tiles = [
    { lbl: "Views", val: data.views, icon: "eye" },
    { lbl: "Inquiries", val: data.inquiries, icon: "chatbubble" },
    { lbl: "Bookings", val: data.total_bookings, icon: "calendar" },
    { lbl: "Revenue", val: formatINRShort(data.revenue), icon: "trending-up" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text style={styles.name}>{user?.name?.split(" ")[0]}</Text>
        {data.founding_vendor && (
          <View style={styles.founding}><Ionicons name="star" size={12} color={colors.onBrand} /><Text style={styles.foundingT}>Founding Vendor · Hyderabad</Text></View>
        )}
        <Pressable testID="kyc-prompt" onPress={() => router.push("/kyc")} style={[styles.kycPrompt, { borderColor: kyc.color + "77" }]}>
          <Ionicons name={kyc.icon as any} size={20} color={kyc.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: kyc.color, fontWeight: "600" }}>KYC: {kyc.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{kyc.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <View style={styles.strength} testID="profile-strength">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={styles.strengthT}>Profile strength</Text>
            <Text style={styles.strengthPct}>{comp.percent}%</Text>
          </View>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${comp.percent}%` }]} /></View>
          <Text style={{ color: comp.listable ? colors.success : colors.textMuted, fontSize: 12, marginTop: 6 }}>
            {comp.listable ? "✓ Live — customers in your city can find you" : "Finish the steps below to go live on Thara"}
          </Text>
          <View style={{ marginTop: spacing.md, gap: 2 }}>
            {STEPS.map((st) => {
              const ok = !!comp.checks?.[st.key];
              return (
                <Pressable key={st.key} testID={`step-${st.key}`} onPress={() => router.push(st.route as any)} style={styles.step}>
                  <Ionicons name={ok ? "checkmark-circle" : "ellipse-outline"} size={18} color={ok ? colors.success : colors.borderStrong} />
                  <Text style={[styles.stepT, ok && { color: colors.textMuted, textDecorationLine: "line-through" }]}>{st.label}</Text>
                  {!ok && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.grid}>
        {tiles.map(t => (
          <View key={t.lbl} style={styles.tile}>
            <Ionicons name={t.icon as any} size={20} color={colors.brand} />
            <Text style={styles.tileVal}>{t.val}</Text>
            <Text style={styles.tileLbl}>{t.lbl}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.row, { marginHorizontal: spacing.xl, marginTop: spacing.lg }]}>
        <View style={styles.statusBox}>
          <Text style={styles.statusN}>{data.pending}</Text>
          <Text style={styles.statusL}>Pending</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={[styles.statusN, { color: colors.success }]}>{data.confirmed}</Text>
          <Text style={styles.statusL}>Confirmed</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={[styles.statusN, { color: colors.info }]}>{data.completed}</Text>
          <Text style={styles.statusL}>Completed</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable testID="edit-profile-link" onPress={() => router.push("/vendor-profile-edit")} style={styles.action}>
          <Ionicons name="create" size={22} color={colors.brand} />
          <Text style={styles.actT}>Edit Business Profile</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable testID="services-link" onPress={() => router.push("/vendor-services")} style={styles.action}>
          <Ionicons name="construct" size={22} color={colors.brand} />
          <Text style={styles.actT}>Packages & Services ({data.services_count ?? 0})</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable testID="avail-link" onPress={() => router.push("/vendor-availability")} style={styles.action}>
          <Ionicons name="calendar" size={22} color={colors.brand} />
          <Text style={styles.actT}>Availability Calendar</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable testID="kyc-link" onPress={() => router.push("/kyc")} style={styles.action}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
          <Text style={styles.actT}>KYC Verification · {kyc.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}
const styles = themedStyles((colors) => ({
  welcome: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 28, fontWeight: "500" },
  kycPrompt: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning + "55" },
  founding: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, marginTop: 8 },
  foundingT: { color: colors.onBrand, fontSize: 11, fontWeight: "700" },
  strength: { marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand + "55" },
  strengthT: { color: colors.text, fontSize: 15, fontWeight: "600" },
  strengthPct: { color: colors.brand, fontSize: 22, fontWeight: "700" },
  barBg: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, marginTop: 8, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  step: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  stepT: { color: colors.text, fontSize: 14, flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.xl, gap: 12 },
  tile: { flexBasis: "47%", padding: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, gap: 6 },
  tileVal: { color: colors.brand, fontSize: 26, fontWeight: "600" },
  tileLbl: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: "row", gap: 10 },
  statusBox: { flex: 1, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statusN: { color: colors.warning, fontSize: 22, fontWeight: "600" },
  statusL: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actions: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, gap: spacing.sm },
  action: { flexDirection: "row", alignItems: "center", gap: 14, padding: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  actT: { color: colors.text, fontSize: 15, fontWeight: "500", flex: 1 },
}));
