import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

const LABELS: any = {
  earn: "Booking earnings",
  redeem: "Redeemed at checkout",
  referral_signup: "Referral signup bonus",
  referral_bonus: "Friend joined with your code",
};

export default function Points() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [tier, setTier] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.get("/me/points"), api.get("/me/tier")]).then(([p, t]) => { setData(p); setTier(t); });
  }, []);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    loader: { flex: 1, backgroundColor: c.surface, justifyContent: "center" },
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: c.border },
    title: { color: c.text, fontSize: 20, fontWeight: "600" },
    tierShadow: { marginHorizontal: spacing.xl, marginTop: spacing.md, borderRadius: 20, shadowColor: c.brand, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    tierCard: { padding: 18, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
    tierIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
    tierEyebrow: { color: "rgba(255,255,255,0.85)", fontSize: 10, letterSpacing: 3, fontWeight: "600" },
    tierName: { color: "#fff", fontSize: 26, fontWeight: "700", letterSpacing: 1, marginTop: 2, textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 6 },
    boostBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
    boostText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
    progressLbl: { color: "rgba(255,255,255,0.95)", fontSize: 12 },
    progressBar: { height: 6, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 3, overflow: "hidden", marginTop: 6 },
    progressFill: { height: "100%", borderRadius: 3, backgroundColor: "#fff" },
    lifeT: { color: "rgba(255,255,255,0.75)", fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
    perks: { marginTop: spacing.md, gap: 5 },
    perk: { flexDirection: "row", alignItems: "center", gap: 6 },
    perkText: { color: "rgba(255,255,255,0.94)", fontSize: 12 },
    balanceCard: { alignItems: "center", padding: spacing.lg, marginHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: c.brandTint, borderRadius: radius.lg, borderWidth: 1, borderColor: c.brand, gap: 2 },
    balance: { color: c.brand, fontSize: 36, fontWeight: "300", marginTop: 2 },
    balanceLbl: { color: c.textSubtle, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
    balanceSub: { color: c.textMuted, fontSize: 11, marginTop: 3 },
    section: { color: c.text, fontSize: 14, fontWeight: "600", paddingHorizontal: spacing.xl, marginBottom: spacing.xs, marginTop: spacing.sm },
    row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: c.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
    boostTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: c.brandTint, borderWidth: 1, borderColor: c.brand },
    boostTagT: { color: c.brand, fontSize: 9, fontWeight: "700" },
    rowTitle: { color: c.text, fontWeight: "600" },
    rowMeta: { color: c.textMuted, fontSize: 12 },
    delta: { fontWeight: "700", fontSize: 16 },
    empty: { color: c.textMuted, textAlign: "center", marginTop: 30 },
  }));

  if (!data || !tier) return <View style={styles.loader}><ActivityIndicator color={colors.brand} /></View>;

  const t = tier.tier;
  const progressPct = Math.round(tier.progress * 100);
  const remaining = t.next_at ? Math.max(0, t.next_at - tier.lifetime_points) : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Thara Points</Text>
      </View>

      <View testID="tier-card" style={styles.tierShadow}>
        <LinearGradient colors={
          t.name === "Platinum" ? ["#E5E4E2", "#B8B6B0", "#7A7872"] :
          t.name === "Gold"     ? ["#F8E27E", "#D4AF37", "#8C7022"] :
                                  ["#D8D8D8", "#9A9A9A", "#5A5A5A"]
        } start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tierCard}>
          <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)"]} style={StyleSheet.absoluteFillObject} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.tierIcon}>
              <Ionicons name={t.icon} size={26} color={t.name === "Gold" ? "#3A2D08" : "#1A1A1F"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tierEyebrow}>THARA MEMBER</Text>
              <Text style={styles.tierName}>{t.name}</Text>
            </View>
            {t.boost > 0 && (
              <View style={styles.boostBadge}>
                <Text style={styles.boostText}>+{Math.round(t.boost * 100)}%</Text>
              </View>
            )}
          </View>
          {t.next ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.progressLbl}>
                {remaining} pts to <Text style={{ fontWeight: "700" }}>{t.next}</Text>
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.lifeT}>Lifetime: {tier.lifetime_points} pts</Text>
            </View>
          ) : (
            <Text style={[styles.lifeT, { marginTop: spacing.md }]}>👑 Top tier — Lifetime {tier.lifetime_points} pts</Text>
          )}
          <View style={styles.perks}>
            {t.perks.map((p: string) => (
              <View key={p} style={styles.perk}>
                <Ionicons name="checkmark-circle" size={13} color="rgba(255,255,255,0.95)" />
                <Text style={styles.perkText}>{p}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      <View style={styles.balanceCard} testID="points-balance">
        <Ionicons name="diamond" size={28} color={colors.brand} />
        <Text style={styles.balance}>{data.balance}</Text>
        <Text style={styles.balanceLbl}>Available Points</Text>
        <Text style={styles.balanceSub}>≈ ₹{data.balance} • Redeem at checkout (up to 20% off)</Text>
      </View>

      <Text style={styles.section}>History</Text>
      <FlatList
        data={data.history}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 8, paddingBottom: 60 }}
        ListEmptyComponent={<Text style={styles.empty}>No activity yet. Book or invite a friend to earn points!</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.rowTitle}>{LABELS[item.reason] || item.reason}</Text>
                {item.boost_pct ? (
                  <View style={styles.boostTag}><Text style={styles.boostTagT}>+{item.boost_pct}% {item.tier}</Text></View>
                ) : null}
              </View>
              <Text style={styles.rowMeta}>{new Date(item.at).toLocaleString()}</Text>
            </View>
            <Text style={[styles.delta, { color: item.delta > 0 ? colors.success : colors.error }]}>
              {item.delta > 0 ? "+" : ""}{item.delta}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
