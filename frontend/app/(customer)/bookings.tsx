import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

export default function Bookings() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    h: { color: c.text, fontSize: 22, fontWeight: "600", paddingHorizontal: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.sm },
    card: { flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.lg, marginBottom: spacing.sm, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    img: { width: 92, height: 100 },
    name: { color: c.text, fontSize: 14, fontWeight: "600" },
    meta: { color: c.textMuted, fontSize: 12 },
    tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1 },
    tagT: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
    exploreBtn: { backgroundColor: c.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md, marginTop: 12 },
    exploreText: { color: c.onBrand, fontWeight: "600" },
    empty: { color: c.textMuted },
  }));

  const statusColor = (s: string) => ({
    pending: colors.warning, confirmed: colors.success, rejected: colors.error,
    completed: colors.info, cancelled: colors.textMuted,
  } as any)[s] || colors.textMuted;

  const load = useCallback(async () => {
    try { setItems(await api.get("/bookings")); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
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
              <Text style={styles.empty}>No bookings yet</Text>
              <Pressable testID="explore-btn" onPress={() => router.push("/(customer)/home")} style={styles.exploreBtn}>
                <Text style={styles.exploreText}>Explore vendors</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const sc = statusColor(item.status);
            const paid = item.payment_status === "paid";
            return (
              <Pressable testID={`booking-${item.id}`} onPress={() => router.push(`/booking-detail/${item.id}`)} style={styles.card}>
                <Image source={{ uri: item.vendor_cover }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.vendor_name}</Text>
                  <Text style={styles.meta}>{item.event_type} • {item.event_date}</Text>
                  <Text style={styles.meta}>{item.guests} guests • ₹{item.amount.toLocaleString("en-IN")}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <View style={[styles.tag, { backgroundColor: sc + "22", borderColor: sc }]}>
                      <Text style={[styles.tagT, { color: sc }]}>{item.status.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.tag, { borderColor: paid ? colors.success : colors.textMuted }]}>
                      <Text style={[styles.tagT, { color: paid ? colors.success : colors.textMuted }]}>{item.payment_status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
