import { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const STATUS_COLORS: any = { pending: colors.warning, confirmed: colors.success, rejected: colors.error, completed: colors.info, cancelled: colors.textMuted };

export default function VendorBookings() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.get("/bookings")); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/bookings/${id}/status?status_val=${status}`); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <Text style={styles.h}>Bookings Inbox</Text>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 40 }}>No bookings yet</Text>}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`vb-${item.id}`}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Image source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.customer_name)}&background=D4AF37&color=0B0C10` }} style={styles.av} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: "500" }}>{item.customer_name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.event_type} • {item.event_date}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.guests} guests • ₹{item.amount.toLocaleString("en-IN")}</Text>
                </View>
                <View style={[styles.tag, { borderColor: STATUS_COLORS[item.status], backgroundColor: STATUS_COLORS[item.status] + "22" }]}>
                  <Text style={[styles.tagT, { color: STATUS_COLORS[item.status] }]}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              {item.notes ? <Text style={styles.notes}>"{item.notes}"</Text> : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
                {item.status === "pending" && (
                  <>
                    <Pressable testID={`accept-${item.id}`} onPress={() => updateStatus(item.id, "confirmed")} style={[styles.btn, { backgroundColor: colors.brand }]}>
                      <Text style={{ color: colors.onBrand, fontWeight: "600", fontSize: 13 }}>Accept</Text>
                    </Pressable>
                    <Pressable testID={`reject-${item.id}`} onPress={() => updateStatus(item.id, "rejected")} style={[styles.btn, styles.ghBtn]}>
                      <Text style={{ color: colors.error, fontWeight: "500", fontSize: 13 }}>Reject</Text>
                    </Pressable>
                  </>
                )}
                {item.status === "confirmed" && (
                  <Pressable testID={`complete-${item.id}`} onPress={() => updateStatus(item.id, "completed")} style={[styles.btn, { backgroundColor: colors.info }]}>
                    <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 13 }}>Mark Completed</Text>
                  </Pressable>
                )}
                <Pressable testID={`chat-${item.id}`} onPress={() => router.push(`/chat/${item.id}`)} style={[styles.btn, styles.ghBtn]}>
                  <Ionicons name="chatbubble" size={14} color={colors.brand} />
                  <Text style={{ color: colors.brand, fontWeight: "500", fontSize: 13, marginLeft: 6 }}>Chat</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 24, fontWeight: "500", paddingHorizontal: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.md },
  card: { padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  av: { width: 50, height: 50, borderRadius: 25 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderWidth: 1, alignSelf: "flex-start" },
  tagT: { fontSize: 10, fontWeight: "700" },
  notes: { color: colors.textSubtle, fontSize: 13, marginTop: 6, fontStyle: "italic" },
  btn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md },
  ghBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface3 },
});
