import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing, useThemedStyles } from "@/src/theme";
import { Divider, EyebrowLabel, StatusText, gutter } from "@/src/components/ui";
import { EmptyState } from "@/src/components/Polish";
import { GoldButton } from "@/src/components/UI";
import { useOnReconnect } from "@/src/hooks/use-reconnect";

export default function Bookings() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    head: { paddingHorizontal: gutter, marginTop: spacing.md, marginBottom: spacing.sm, gap: 4 },
    h: { color: c.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold },
    card: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 16 },
    img: { width: 84, height: 96, borderRadius: 14, backgroundColor: c.surface3 },
    name: { color: c.text, fontSize: 20, lineHeight: 24, fontFamily: fonts.displayBold },
    meta: { color: c.textMuted, fontSize: 12.5, textTransform: "capitalize" },
  }));

  const statusColor = (s: string) => ({
    pending: colors.warning, confirmed: colors.warning, booked: colors.success,
    rejected: colors.error, completed: colors.info, cancelled: colors.textMuted,
  } as any)[s] || colors.textMuted;

  const load = useCallback(async () => {
    try { setItems(await api.get("/bookings")); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useOnReconnect(load);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <EyebrowLabel>Your celebrations</EyebrowLabel>
        <Text style={styles.h}>My Bookings</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} showsVerticalScrollIndicator={false}
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <Divider />}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ marginTop: 40 }}>
              <EmptyState icon="calendar-outline" title="No bookings yet" message="When you book a partner, your celebration plans live here." />
              <GoldButton testID="explore-btn" title="Explore partners" onPress={() => router.push("/(customer)/home")} style={{ marginHorizontal: spacing.xxxl }} />
            </View>
          }
          renderItem={({ item }) => {
            const sc = statusColor(item.status);
            const total = item.total_amount ?? item.price_breakdown?.total ?? item.amount;
            return (
              <Pressable testID={`booking-${item.id}`} onPress={() => router.push(`/booking-detail/${item.id}`)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.6 }]}>
                <Image source={{ uri: item.vendor_cover }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.vendor_name}</Text>
                  <Text style={styles.meta}>{item.event_type} • {item.event_date}</Text>
                  <Text style={styles.meta}>{item.guests} guests • ₹{(total || 0).toLocaleString("en-IN")}</Text>
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
                    <StatusText status={item.display_status || item.status} color={sc} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ opacity: 0.6 }} />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
