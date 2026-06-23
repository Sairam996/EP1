import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const STATUS_COLORS: any = {
  pending: colors.warning, confirmed: colors.success, rejected: colors.error,
  completed: colors.info, cancelled: colors.textMuted,
};

export default function Bookings() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.get("/bookings")); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <Text style={styles.h}>My Bookings</Text>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60, gap: 8 }}>
              <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }}>No bookings yet</Text>
              <Pressable testID="explore-btn" onPress={() => router.push("/(customer)/home")} style={styles.exploreBtn}>
                <Text style={{ color: colors.onBrand, fontWeight: "600" }}>Explore vendors</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable testID={`booking-${item.id}`} onPress={() => router.push(`/booking-detail/${item.id}`)} style={styles.card}>
              <Image source={{ uri: item.vendor_cover }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>{item.vendor_name}</Text>
                <Text style={styles.meta}>{item.event_type} • {item.event_date}</Text>
                <Text style={styles.meta}>{item.guests} guests • ₹{item.amount.toLocaleString("en-IN")}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <View style={[styles.tag, { backgroundColor: STATUS_COLORS[item.status] + "22", borderColor: STATUS_COLORS[item.status] }]}>
                    <Text style={[styles.tagT, { color: STATUS_COLORS[item.status] }]}>{item.status.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.tag, { borderColor: item.payment_status === "paid" ? colors.success : colors.textMuted }]}>
                    <Text style={[styles.tagT, { color: item.payment_status === "paid" ? colors.success : colors.textMuted }]}>{item.payment_status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 18, fontWeight: "500", paddingHorizontal: spacing.xl, marginTop: spacing.xs, marginBottom: spacing.sm },
  card: { flexDirection: "row", backgroundColor: colors.surface2, borderRadius: radius.lg, marginBottom: spacing.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  img: { width: 84, height: 92 },
  name: { color: colors.text, fontSize: 14, fontWeight: "500" },
  meta: { color: colors.textMuted, fontSize: 11 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  tagT: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  exploreBtn: { backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md, marginTop: 12 },
});
