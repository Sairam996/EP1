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

  useEffect(() => { api.get("/me/points").then(setData); }, []);

  if (!data) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>EventPro Points</Text>
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
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 30 }}>No activity yet. Book or invite a friend to earn points!</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "500" }}>{LABELS[item.reason] || item.reason}</Text>
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
  balanceCard: { alignItems: "center", padding: spacing.xl, margin: spacing.xl, backgroundColor: colors.brandTint, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, gap: 4 },
  balance: { color: colors.brand, fontSize: 48, fontWeight: "300", marginTop: 4 },
  balanceLbl: { color: colors.textSubtle, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  balanceSub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  section: { color: colors.text, fontSize: 16, fontWeight: "500", paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
