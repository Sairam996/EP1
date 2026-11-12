import { useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, fonts, spacing, themedStyles } from "@/src/theme";
import { Divider, EyebrowLabel, ListRow, Section, StatStrip, gutter } from "@/src/components/ui";
import { useOnReconnect } from "@/src/hooks/use-reconnect";

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
  useOnReconnect(load);

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
    { lbl: "Advances", val: formatINRShort(data.advances_collected ?? 0), icon: "trending-up" },
    { lbl: "Balance due", val: formatINRShort(data.balances_pending ?? 0), icon: "wallet" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}>
      <View style={{ paddingHorizontal: gutter, marginTop: spacing.md }}>
        <EyebrowLabel>{data.founding_vendor ? "Founding Vendor · Hyderabad" : "Partner dashboard"}</EyebrowLabel>
        <Text style={styles.name}>Welcome back, {user?.name?.split(" ")[0]}</Text>
      </View>

      <View style={{ paddingHorizontal: gutter, marginTop: spacing.lg }}>
        <Divider />
        <ListRow testID="kyc-prompt" icon={kyc.icon.endsWith("-outline") ? (kyc.icon as any) : (`${kyc.icon}-outline` as any)} iconColor={kyc.color}
          title={`KYC · ${kyc.label}`} subtitle={kyc.sub} onPress={() => router.push("/kyc")} last />
        <Divider />
      </View>

      <StatStrip style={{ marginHorizontal: gutter, marginTop: spacing.lg }} items={tiles.map((t) => ({ id: `stat-${t.lbl}`, value: t.val ?? 0, label: t.lbl }))} />
      <Divider style={{ marginHorizontal: gutter }} />
      <StatStrip style={{ marginHorizontal: gutter }} items={[
        { id: "st-pending", value: data.pending ?? 0, label: "Pending", onPress: () => router.push("/(vendor)/bookings") },
        { id: "st-confirmed", value: data.confirmed ?? 0, label: "Awaiting advance", onPress: () => router.push("/(vendor)/bookings") },
        { id: "st-booked", value: data.booked ?? 0, label: "Booked", onPress: () => router.push("/(vendor)/bookings") },
        { id: "st-completed", value: data.completed ?? 0, label: "Completed", onPress: () => router.push("/(vendor)/bookings") },
      ]} />
      <Divider style={{ marginHorizontal: gutter }} />

      <Section eyebrow="Profile strength" testID="profile-strength">
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={styles.strengthPct}>{comp.percent}%</Text>
          <Text style={{ color: comp.listable ? colors.success : colors.textMuted, fontSize: 12, flexShrink: 1, textAlign: "right", marginLeft: 12 }}>
            {comp.listable ? "Live — customers in your city can find you" : "Finish the steps below to go live"}
          </Text>
        </View>
        <View style={styles.barBg}><View style={[styles.barFill, { width: `${comp.percent}%` }]} /></View>
        <View style={{ marginTop: spacing.sm }}>
          {STEPS.map((st, i) => {
            const ok = !!comp.checks?.[st.key];
            return (
              <ListRow key={st.key} testID={`step-${st.key}`} icon={ok ? "checkmark-circle-outline" : "ellipse-outline"} iconColor={ok ? colors.success : undefined}
                title={st.label} titleStyle={ok ? { color: colors.textMuted, textDecorationLine: "line-through" } : undefined}
                onPress={() => router.push(st.route as any)} chevron={!ok} last={i === STEPS.length - 1} />
            );
          })}
        </View>
      </Section>

      <Section eyebrow="Manage">
        <Divider />
        <ListRow testID="edit-profile-link" icon="create-outline" title="Edit Business Profile" subtitle="Photos, story, event types" onPress={() => router.push("/vendor-profile-edit")} />
        <ListRow testID="services-link" icon="pricetags-outline" title="Packages & Services" subtitle={`${data.services_count ?? 0} listed`} onPress={() => router.push("/vendor-services")} />
        <ListRow testID="avail-link" icon="calendar-outline" title="Availability Calendar" subtitle="Block dates you're booked" onPress={() => router.push("/vendor-availability")} />
        <ListRow testID="kyc-link" icon="shield-checkmark-outline" title="KYC Verification" subtitle={kyc.label} onPress={() => router.push("/kyc")} last />
      </Section>
    </ScrollView>
  );
}
const styles = themedStyles((colors) => ({
  name: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold, marginTop: 6 },
  strengthPct: { color: colors.mode === "dark" ? "#E2BE6E" : "#8C6A26", fontSize: 44, lineHeight: 48, fontFamily: fonts.displayBold },
  barBg: { height: 2, borderRadius: 1, backgroundColor: colors.mode === "dark" ? "rgba(226,190,110,0.15)" : "rgba(140,106,38,0.15)", marginTop: 10, overflow: "hidden" },
  barFill: { height: 2, borderRadius: 1, backgroundColor: colors.mode === "dark" ? "#E2BE6E" : "#8C6A26" },
}));
