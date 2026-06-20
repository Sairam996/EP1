import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

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

  const tiles = [
    { lbl: "Views", val: data.views, icon: "eye" },
    { lbl: "Inquiries", val: data.inquiries, icon: "chatbubble" },
    { lbl: "Bookings", val: data.total_bookings, icon: "calendar" },
    { lbl: "Revenue", val: `₹${(data.revenue / 1000).toFixed(1)}k`, icon: "trending-up" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text style={styles.name}>{user?.name?.split(" ")[0]}</Text>
        {!data.verified && (
          <Pressable testID="kyc-prompt" onPress={() => router.push("/kyc")} style={styles.kycPrompt}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={{ color: colors.textSubtle, flex: 1 }}>Complete KYC to get the Verified badge</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
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
        <Pressable testID="services-link" onPress={() => router.push("/vendor-services")} style={styles.action}>
          <Ionicons name="construct" size={22} color={colors.brand} />
          <Text style={styles.actT}>Manage Services</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable testID="avail-link" onPress={() => router.push("/vendor-availability")} style={styles.action}>
          <Ionicons name="calendar" size={22} color={colors.brand} />
          <Text style={styles.actT}>Availability Calendar</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable testID="kyc-link" onPress={() => router.push("/kyc")} style={styles.action}>
          <Ionicons name="shield-checkmark" size={22} color={colors.brand} />
          <Text style={styles.actT}>KYC Verification {data.verified ? "✓" : ""}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  welcome: { color: colors.textMuted, fontSize: 14 },
  name: { color: colors.text, fontSize: 28, fontWeight: "500" },
  kycPrompt: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning + "55" },
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
});
