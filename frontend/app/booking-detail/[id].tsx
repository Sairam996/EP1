import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { GoldButton } from "@/src/components/UI";
import { fonts, spacing, useColors, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, KeyValue, ListRow, Section, StatusText, TextLink, editorialGold, gutter } from "@/src/components/ui";
import { formatInr } from "@/src/utils/price";

function prettyMethod(m?: string) {
  if (m === "in_app") return "Paid in the app";
  if (m === "offline") return "Paid directly to the vendor";
  return m || "";
}

function lineStatus(s?: string) {
  const map: Record<string, string> = {
    paid: "Paid",
    paid_in_app: "Paid in the app",
    paid_offline: "Paid to vendor",
    claimed_offline: "Claimed — awaiting vendor",
    due: "Due",
    pending: "Pending",
  };
  return map[s || ""] || (s || "").replace(/_/g, " ");
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const [b, setB] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [acting, setActing] = useState(false);
  const s = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    cover: { width: "100%", height: 300 },
    back: { position: "absolute", left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    heroText: { position: "absolute", left: gutter, right: gutter, bottom: 18 },
    name: { color: "#FFF8EB", fontSize: 32, lineHeight: 36, fontFamily: fonts.displayBold, marginTop: 4 },
    notes: { color: c.textSubtle, marginTop: spacing.md, fontStyle: "italic", fontFamily: fonts.display, fontSize: 17, lineHeight: 23 },
    input: { backgroundColor: c.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, padding: 14, color: c.text, marginTop: spacing.md, minHeight: 96, textAlignVertical: "top", fontSize: 15 },
    when: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  }));

  const load = useCallback(() => { api.get(`/bookings/${id}`).then(setB).catch(console.warn); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submitReview = async () => {
    setSubmitting(true);
    try { await api.post("/reviews", { vendor_id: b.vendor_id, booking_id: b.id, rating, comment }); alert("Thanks for your review!"); setComment(""); }
    catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const confirmCancel = () => {
    const preview = b?.cancel_preview || {};
    const paid = !!b?.advance_paid;
    const msg = paid
      ? (preview.refund_percent === 0
          ? "This is within 48 hours of the event, so the advance will not be refunded. Cancel anyway?"
          : `You’ll receive a ${preview.refund_percent}% refund of the advance (₹${formatInr(preview.refund_amount)}). Cancel this booking?`)
      : "Withdraw this unpaid request? The vendor will be notified.";
    Alert.alert("Cancel booking?", msg, [
      { text: "Keep booking", style: "cancel" },
      { text: "Yes, cancel", style: "destructive", onPress: doCancel },
    ]);
  };

  const doCancel = async () => {
    setCancelling(true);
    try { setB(await api.post(`/bookings/${id}/cancel`)); }
    catch (e: any) { Alert.alert("Couldn’t cancel", e.message); }
    finally { setCancelling(false); }
  };

  const act = async (fn: () => Promise<any>, errTitle: string) => {
    setActing(true);
    try { setB(await fn()); }
    catch (e: any) { Alert.alert(errTitle, e.message); }
    finally { setActing(false); }
  };

  if (!b) return <View style={[s.root, { justifyContent: "center" }]}><ActivityIndicator color={colors.brand} /></View>;

  const advancePayable = !!b.advance_payable;
  const balancePayable = !!b.balance_payable;
  const settled = !!b.balance_settled;
  const claimed = b.balance_status === "claimed_offline";
  const canCancel = !!b.cancel_preview?.cancellable;
  const primaryIsPay = !isVendor && (advancePayable || balancePayable);
  const vendorCanComplete = isVendor && b.status === "booked" && settled;
  const vendorCanMarkBalance = isVendor && b.status === "booked" && !settled && !!b.event_reached;
  const vendorPending = isVendor && b.status === "pending";

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 100 }}>
      <View>
        <Image source={{ uri: b.vendor_cover }} style={s.cover} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.85)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={[s.back, { top: insets.top + 8 }]}><Ionicons name="arrow-back" size={20} color="#FFF8EB" /></Pressable>
        <View style={s.heroText}>
          <Text style={{ color: "#E2BE6E", fontSize: 10.5, fontWeight: "700", letterSpacing: 2.2 }}>BOOKING DETAILS</Text>
          <Text style={s.name} numberOfLines={2}>{isVendor ? b.customer_name : b.vendor_name}</Text>
          <View style={{ marginTop: 8 }}><StatusText status={b.display_status || b.status} /></View>
        </View>
      </View>

      <Section eyebrow="Your event">
        <KeyValue label="Event" value={String(b.event_type || "").replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase())} />
        <KeyValue label="Date" value={b.event_date} />
        <KeyValue label="Guests" value={String(b.guests)} />
        <KeyValue label="Service" value={`₹${formatInr(b.price_breakdown?.service ?? b.amount)}`} />
        <KeyValue label="GST (5%)" value={`₹${formatInr(b.price_breakdown?.gst ?? b.gst_amount)}`} />
        <KeyValue label="Total" value={`₹${formatInr(b.price_breakdown?.total ?? b.total_amount ?? b.amount)}`} emphasis valueColor={editorialGold(colors)} last />
        {b.notes ? <Text style={s.notes}>“{b.notes}”</Text> : null}
        {b.status === "pending" ? (
          <Text style={[s.notes, { fontStyle: "normal", marginTop: spacing.md }]}>
            {isVendor ? "Accept this request so the customer can pay a 20% advance and lock the date." : "Waiting for the vendor to accept. You’ll pay a 20% advance once they confirm."}
          </Text>
        ) : null}
        {b.status === "confirmed" ? (
          <Text style={[s.notes, { fontStyle: "normal", marginTop: spacing.md }]}>
            {isVendor ? "Waiting for the customer to pay the 20% advance." : "The vendor has accepted. Pay a 20% advance to lock this date."}
          </Text>
        ) : null}
        {b.refund_status && b.refund_status !== "n/a" ? (
          <Text style={[s.notes, { fontStyle: "normal" }]}>
            {b.refund_status === "refunded" ? `Refund of ₹${formatInr(b.refund_amount)} (${b.refund_percent}% of the advance) is being processed.` : "This booking was cancelled with no refund of the advance, as it was within 48 hours of the event."}
          </Text>
        ) : null}
      </Section>

      <Section eyebrow="Payments">
        {(b.payment_timeline || []).map((line: any, i: number) => {
          const last = i === (b.payment_timeline.length - 1);
          const dueLater = line.key === "balance" && line.status === "due" && !line.unlocked;
          const value = dueLater
            ? `Due on ${line.due_on}`
            : `${lineStatus(line.status)}${line.amount != null ? ` · ₹${formatInr(line.charged ?? line.amount)}` : ""}`;
          return (
            <View key={line.key}>
              <KeyValue label={line.label} value={value} last={last && !line.at && !line.method} />
              {line.at ? <Text style={s.when}>{line.status === "claimed_offline" ? "Claimed" : "Paid"} {new Date(line.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{line.method ? ` · ${prettyMethod(line.method)}` : ""}</Text> : null}
            </View>
          );
        })}
      </Section>

      <View style={{ paddingHorizontal: gutter, marginTop: spacing.lg }}>
        {b.status !== "rejected" && b.status !== "cancelled" ? (
          <ListRow icon="chatbubbles-outline" title={isVendor ? "Message customer" : "Message vendor"} subtitle="Chat about your event details" onPress={() => router.push(`/chat/${b.id}`)} last={!primaryIsPay} />
        ) : (
          <ListRow icon="chatbubbles-outline" title="Conversation closed" subtitle="This booking is no longer active" last />
        )}
        {!isVendor && advancePayable ? (
          <ListRow icon="card-outline" title={`Pay 20% advance ₹${formatInr(b.advance_amount)}`} subtitle="Locks the date" onPress={() => router.push(`/checkout/${b.id}?kind=advance`)} testID="pay-advance" last />
        ) : null}
      </View>

      {!isVendor && balancePayable ? (
        <Section eyebrow="Balance">
          <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21 }}>The remaining ₹{formatInr(b.balance_amount)} can be paid in the app or directly to the vendor.</Text>
          <GoldButton testID="pay-balance" title={`Pay balance ₹${formatInr(b.balance_amount)}`} onPress={() => router.push(`/checkout/${b.id}?kind=balance`)} style={{ marginTop: spacing.lg }} />
          <View style={{ marginTop: spacing.md, alignItems: "center" }}>
            <TextLink testID="claim-offline" title="I paid the vendor directly" onPress={() => act(() => api.post(`/bookings/${id}/balance/claim`), "Couldn’t record this")} />
          </View>
        </Section>
      ) : null}

      {!isVendor && b.status === "booked" && !settled && !b.event_reached ? (
        <Section eyebrow="Balance">
          <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21 }} testID="balance-due-on">
            Due on {b.event_date}. You can pay in the app or directly to the vendor from that day.
          </Text>
        </Section>
      ) : null}

      {!isVendor && claimed ? (
        <Section eyebrow="Balance">
          <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21 }}>You’ve told us you paid the vendor directly. Waiting for them to confirm they received ₹{formatInr(b.balance_amount)}.</Text>
        </Section>
      ) : null}

      {vendorPending ? (
        <Section eyebrow="Respond">
          <GoldButton testID="accept-booking" title="Accept request" onPress={() => act(() => api.patch(`/bookings/${id}/status?status_val=confirmed`), "Couldn’t accept")} loading={acting} />
          <View style={{ marginTop: spacing.md, alignItems: "center" }}>
            <TextLink testID="reject-booking" title="Decline" color={colors.error} onPress={() => act(() => api.patch(`/bookings/${id}/status?status_val=rejected`), "Couldn’t decline")} />
          </View>
        </Section>
      ) : null}

      {vendorCanMarkBalance ? (
        <Section eyebrow="Balance">
          <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21 }}>
            {claimed ? "The customer says they paid you directly. Confirm if you received the balance." : `₹${formatInr(b.balance_amount)} is still outstanding. Confirm when you receive it, or the customer can pay in the app.`}
          </Text>
          <GoldButton testID="mark-balance" title="Mark balance received" onPress={() => act(() => api.post(`/bookings/${id}/balance/confirm`), "Couldn’t update")} loading={acting} style={{ marginTop: spacing.lg }} />
        </Section>
      ) : null}

      {vendorCanComplete ? (
        <Section eyebrow="After the event">
          <GoldButton testID="complete-booking" title="Mark completed" onPress={() => act(() => api.patch(`/bookings/${id}/status?status_val=completed`), "Couldn’t complete")} loading={acting} />
        </Section>
      ) : null}

      {isVendor && b.status === "booked" && !settled && !b.event_reached ? (
        <Section eyebrow="Balance">
          <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21 }}>₹{formatInr(b.balance_amount)} is due on {b.event_date}.</Text>
        </Section>
      ) : null}

      {isVendor && b.status === "confirmed" ? (
        <Section eyebrow="Advance">
          <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21 }}>Waiting for a 20% advance of ₹{formatInr(b.advance_amount)} to lock this date.</Text>
        </Section>
      ) : null}

      {canCancel && !isVendor ? (
        <Section eyebrow="Cancellation">
          <Text style={{ color: colors.textSubtle, fontSize: 13, lineHeight: 20 }} testID="cancel-policy">{b.cancel_preview.policy}</Text>
          {b.advance_paid ? (
            <Text style={{ color: colors.text, marginTop: 10, fontSize: 14 }}>
              If you cancel now, {b.cancel_preview.refund_percent === 0 ? "the advance will not be refunded." : `you’ll receive a ${b.cancel_preview.refund_percent}% refund of the advance (₹${formatInr(b.cancel_preview.refund_amount)}).`}
            </Text>
          ) : (
            <Text style={{ color: colors.textSubtle, marginTop: 10, fontSize: 14 }}>This request is unpaid, so you can withdraw it at no charge.</Text>
          )}
          {primaryIsPay || balancePayable ? (
            <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
              <TextLink testID="cancel-booking" title={b.advance_paid ? "Cancel booking" : "Withdraw request"} color={colors.error} onPress={confirmCancel} />
            </View>
          ) : (
            <GoldButton testID="cancel-booking" title={b.advance_paid ? "Cancel booking" : "Withdraw request"} onPress={confirmCancel} loading={cancelling} style={{ marginTop: spacing.lg }} />
          )}
        </Section>
      ) : null}

      {b.status === "completed" && !isVendor && (
        <Section eyebrow="Share your experience" title="Leave a Review">
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} testID={`star-${n}`} hitSlop={4}>
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={30} color={editorialGold(colors)} />
              </Pressable>
            ))}
          </View>
          <TextInput value={comment} onChangeText={setComment} placeholder="Share your experience..." placeholderTextColor={colors.textMuted} style={s.input} multiline testID="review-text" />
          <GoldButton testID="review-submit" title="Submit Review" onPress={submitReview} loading={submitting} style={{ marginTop: spacing.lg }} />
        </Section>
      )}
      <EyebrowLabel muted style={{ textAlign: "center", marginTop: spacing.xxxl, fontSize: 9.5 }}>{`Ref · ${String(b.id).slice(0, 8)}`}</EyebrowLabel>
    </ScrollView>
  );
}
