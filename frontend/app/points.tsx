import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const LABELS: any = {
  earn: "Booking earnings",
  redeem: "Redeemed at checkout",
  referral_signup: "Referral signup bonus",
  referral_bonus: "Friend joined with your code",
};

export default function Points() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [tier, setTier] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.get("/me/points"), api.get("/me/tier")]).then(([p, t]) => { setData(p); setTier(t); });
  }, []);

  if (!data || !tier) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  const t = tier.tier;
  const progressPct = Math.round(tier.progress * 100);
  const remaining = t.next_at ? Math.max(0, t.next_at - tier.lifetime_points) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>EventPro Points</Text>
      </View>

      {/* Tier card */}
      <View testID="tier-card" style={[styles.tierCard, { borderColor: t.color }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.tierIcon, { backgroundColor: t.color + "22", borderColor: t.color }]}>
            <Ionicons name={t.icon} size={28} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Your Tier</Text>
            <Text style={[styles.tierName, { color: t.color }]}>{t.name}</Text>
          </View>
          {t.boost > 0 && (
            <View style={[styles.boostBadge, { borderColor: t.color }]}>
              <Text style={{ color: t.color, fontSize: 11, fontWeight: "700" }}>+{Math.round(t.boost * 100)}%</Text>
            </View>
          )}
        </View>
        {t.next ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textSubtle, fontSize: 12 }}>
              {remaining} pts to <Text style={{ color: colors.brand, fontWeight: "600" }}>{t.next}</Text>
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: t.color }]} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>Lifetime earned: {tier.lifetime_points}</Text>
          </View>
        ) : (
          <Text style={{ color: t.color, fontSize: 12, marginTop: spacing.md }}>👑 Top tier unlocked</Text>
        )}
        <View style={styles.perks}>
          {t.perks.map((p: string) => (
            <View key={p} style={styles.perk}>
              <Ionicons name="checkmark-circle" size={14} color={t.color} />
              <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{p}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Balance card */}
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
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 30 }}>No activity yet. Book or invite a friend to earn points!</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "500" }}>{LABELS[item.reason] || item.reason}</Text>
                {item.boost_pct ? (
                  <View style={styles.boostTag}><Text style={{ color: colors.brand, fontSize: 9, fontWeight: "700" }}>+{item.boost_pct}% {item.tier}</Text></View>
                ) : null}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{new Date(item.at).toLocaleString()}</Text>
            </View>
            <Text style={{ color: item.delta > 0 ? colors.success : colors.error, fontWeight: "600", fontSize: 16 }}>
              {item.delta > 0 ? "+" : ""}{item.delta}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  tierCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1 },
  tierIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tierName: { fontSize: 20, fontWeight: "500", letterSpacing: 0.5 },
  boostBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  progressBar: { height: 5, backgroundColor: colors.surface3, borderRadius: 3, overflow: "hidden", marginTop: 5 },
  progressFill: { height: "100%", borderRadius: 3 },
  perks: { marginTop: spacing.sm, gap: 4 },
  perk: { flexDirection: "row", alignItems: "center", gap: 6 },
  balanceCard: { alignItems: "center", padding: spacing.lg, marginHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, gap: 2 },
  balance: { color: colors.brand, fontSize: 34, fontWeight: "300", marginTop: 2 },
  balanceLbl: { color: colors.textSubtle, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  balanceSub: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  section: { color: colors.text, fontSize: 14, fontWeight: "500", paddingHorizontal: spacing.xl, marginBottom: spacing.xs, marginTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  boostTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand },
});
