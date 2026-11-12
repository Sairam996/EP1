import { useState, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, fonts, spacing, themedStyles } from "@/src/theme";
import { Divider, EyebrowLabel, StatusText, TextLink, gutter } from "@/src/components/ui";
import { EmptyState } from "@/src/components/Polish";
import { useOnReconnect } from "@/src/hooks/use-reconnect";
import { NumText } from "@/src/components/Num";

const STATUS_COLORS: any = { pending: colors.warning, confirmed: colors.warning, booked: colors.success, rejected: colors.error, completed: colors.info, cancelled: colors.textMuted };

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
  useOnReconnect(load);

  const updateStatus = async (id: string, status: string) => {
    try { await api.patch(`/bookings/${id}/status?status_val=${status}`); load(); } catch (e: any) { alert(e.message); }
  };
  const markBalance = async (id: string) => {
    try { await api.post(`/bookings/${id}/balance/confirm`); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: gutter, marginTop: spacing.md, marginBottom: spacing.sm, gap: 4 }}>
        <EyebrowLabel>Partner</EyebrowLabel>
        <Text style={styles.h}>Bookings Inbox</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} showsVerticalScrollIndicator={false}
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <Divider />}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No bookings yet" message="New requests from customers will appear here." />}
          renderItem={({ item }) => {
            const total = item.total_amount ?? item.price_breakdown?.total ?? item.amount;
            const adv = item.advance_amount ?? 0;
            const bal = item.balance_amount ?? 0;
            const settled = !!item.balance_settled;
            const advPaid = !!item.advance_paid;
            return (
            <View style={styles.card} testID={`vb-${item.id}`}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Image source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.customer_name)}&background=D4AF37&color=0B0C10` }} style={styles.av} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 19 }}>{item.customer_name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.event_type} • {item.event_date}</Text>
                  <NumText style={{ color: colors.textMuted, fontSize: 12 }}>{`${item.guests} guests • ₹${(total || 0).toLocaleString("en-IN")}`}</NumText>
                  {(item.status !== "cancelled" && item.status !== "rejected") && (item.status === "booked" || advPaid) ? (
                    <NumText style={{ color: colors.textMuted, fontSize: 12 }}>
                      {`Advance ${advPaid ? "received" : "due"} ₹${(item.advance_charged ?? adv).toLocaleString("en-IN")}  ·  Balance ${settled ? "settled" : "outstanding ₹" + bal.toLocaleString("en-IN")}`}
                    </NumText>
                  ) : item.status === "confirmed" ? (
                    <NumText style={{ color: colors.textMuted, fontSize: 12 }}>Awaiting 20% advance ₹{adv.toLocaleString("en-IN")}</NumText>
                  ) : null}
                </View>
                <StatusText status={item.display_status || item.status} color={STATUS_COLORS[item.status] || colors.textMuted} />
              </View>
              {item.notes ? <Text style={styles.notes}>&quot;{item.notes}&quot;</Text> : null}
              <View style={{ flexDirection: "row", gap: 22, marginTop: spacing.sm, paddingLeft: 62, flexWrap: "wrap" }}>
                {item.status === "pending" && (
                  <>
                    <TextLink testID={`accept-${item.id}`} title="Accept" icon="checkmark" onPress={() => updateStatus(item.id, "confirmed")} />
                    <TextLink testID={`reject-${item.id}`} title="Reject" color={colors.error} onPress={() => updateStatus(item.id, "rejected")} />
                  </>
                )}
                {item.status === "booked" && !settled && item.event_reached && (
                  <TextLink testID={`balance-${item.id}`} title="Mark balance received" icon="cash-outline" onPress={() => markBalance(item.id)} />
                )}
                {item.status === "booked" && settled && (
                  <TextLink testID={`complete-${item.id}`} title="Mark completed" icon="checkmark-done" onPress={() => updateStatus(item.id, "completed")} />
                )}
                <TextLink testID={`chat-${item.id}`} title="Chat" icon="chatbubble-outline" color={colors.textMuted} onPress={() => router.push(`/chat/${item.id}`)} />
                <TextLink title="Details" color={colors.textMuted} onPress={() => router.push(`/booking-detail/${item.id}`)} />
              </View>
            </View>
            );
          }}
        />
      )}
    </View>
  );
}
const styles = themedStyles((colors) => ({
  h: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold },
  card: { paddingVertical: spacing.lg },
  av: { width: 50, height: 50, borderRadius: 25 },
  notes: { color: colors.textSubtle, fontSize: 15, marginTop: 8, fontStyle: "italic", fontFamily: fonts.display, paddingLeft: 62 },
}));
