import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { fonts, spacing, useColors, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, KeyValue, ListRow, Section, StatusText, editorialGold, gutter } from "@/src/components/ui";
import { formatInr } from "@/src/utils/price";

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [b, setB] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const s = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    cover: { width: "100%", height: 300 },
    back: { position: "absolute", left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    heroText: { position: "absolute", left: gutter, right: gutter, bottom: 18 },
    name: { color: "#FFF8EB", fontSize: 32, lineHeight: 36, fontFamily: fonts.displayBold, marginTop: 4 },
    notes: { color: c.textSubtle, marginTop: spacing.md, fontStyle: "italic", fontFamily: fonts.display, fontSize: 17, lineHeight: 23 },
    input: { backgroundColor: c.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, padding: 14, color: c.text, marginTop: spacing.md, minHeight: 96, textAlignVertical: "top", fontSize: 15 },
  }));

  useEffect(() => { api.get(`/bookings/${id}`).then(setB); }, [id]);

  const submitReview = async () => {
    setSubmitting(true);
    try { await api.post("/reviews", { vendor_id: b.vendor_id, booking_id: b.id, rating, comment }); alert("Thanks for your review!"); setComment(""); }
    catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const confirmCancel = () => {
    const preview = b?.cancel_preview || {};
    const msg = b?.payment_status === "paid"
      ? (preview.refund_percent === 0
          ? "This is within 48 hours of the event, so no refund will be issued. Cancel anyway?"
          : `You’ll receive a ${preview.refund_percent}% refund (₹${formatInr(preview.refund_amount)}). Cancel this booking?`)
      : "Withdraw this unpaid request? The vendor will be notified.";
    Alert.alert("Cancel booking?", msg, [
      { text: "Keep booking", style: "cancel" },
      { text: "Yes, cancel", style: "destructive", onPress: doCancel },
    ]);
  };

  const doCancel = async () => {
    setCancelling(true);
    try {
      const updated = await api.post(`/bookings/${id}/cancel`);
      setB(updated);
    } catch (e: any) { Alert.alert("Couldn’t cancel", e.message); }
    finally { setCancelling(false); }
  };

  if (!b) return <View style={[s.root, { justifyContent: "center" }]}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 100 }}>
      <View>
        <Image source={{ uri: b.vendor_cover }} style={s.cover} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.85)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={[s.back, { top: insets.top + 8 }]}><Ionicons name="arrow-back" size={20} color="#FFF8EB" /></Pressable>
        <View style={s.heroText}>
          <Text style={{ color: "#E2BE6E", fontSize: 10.5, fontWeight: "700", letterSpacing: 2.2 }}>BOOKING DETAILS</Text>
          <Text style={s.name} numberOfLines={2}>{b.vendor_name}</Text>
          <View style={{ marginTop: 8 }}><StatusText status={b.status} /></View>
        </View>
      </View>

      <Section eyebrow="Your event">
        <KeyValue label="Event" value={String(b.event_type || "").replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase())} />
        <KeyValue label="Date" value={b.event_date} />
        <KeyValue label="Guests" value={String(b.guests)} />
        <KeyValue label="Payment" value={<StatusText status={b.payment_status} />} />
        <KeyValue label="Service" value={`₹${formatInr(b.price_breakdown?.service ?? b.amount)}`} />
        {b.price_breakdown ? <KeyValue label="GST (5%)" value={`₹${formatInr(b.price_breakdown.gst)}`} /> : null}
        <KeyValue label="Total" value={`₹${formatInr(b.price_breakdown?.total ?? b.amount)}`} emphasis valueColor={editorialGold(colors)} last />
        {b.notes ? <Text style={s.notes}>“{b.notes}”</Text> : null}
        {b.status === "pending" && b.payment_status !== "paid" ? (
          <Text style={[s.notes, { fontStyle: "normal", marginTop: spacing.md }]}>Waiting for the vendor to confirm. You can pay once they accept.</Text>
        ) : null}
        {b.refund_status && b.refund_status !== "n/a" ? (
          <Text style={[s.notes, { fontStyle: "normal" }]}>
            {b.refund_status === "refunded" ? `Refund of ₹${formatInr(b.refund_amount)} (${b.refund_percent}%) is being processed.` : "This paid booking was cancelled with no refund, as it was within 48 hours of the event."}
          </Text>
        ) : null}
      </Section>

      <View style={{ paddingHorizontal: gutter, marginTop: spacing.lg }}>
        {b.status !== "rejected" && b.status !== "cancelled" ? (
          <ListRow icon="chatbubbles-outline" title="Message Vendor" subtitle="Chat about your event details" onPress={() => router.push(`/chat/${b.id}`)} />
        ) : (
          <ListRow icon="chatbubbles-outline" title="Conversation closed" subtitle="This booking is no longer active" last />
        )}
        {b.status === "confirmed" && b.payment_status !== "paid" && b.payment_status !== "refunded" ? (
          <ListRow icon="card-outline" title="Pay now" subtitle={`₹${formatInr(b.price_breakdown?.total ?? b.amount)} including GST`} onPress={() => router.push(`/checkout/${b.id}`)} testID="pay-now" last={!b.cancel_preview?.cancellable} />
        ) : null}
      </View>

      {b.cancel_preview?.cancellable ? (
        <Section eyebrow="Cancellation">
          <Text style={{ color: colors.textSubtle, fontSize: 13, lineHeight: 20 }} testID="cancel-policy">{b.cancel_preview.policy}</Text>
          {b.payment_status === "paid" ? (
            <Text style={{ color: colors.text, marginTop: 10, fontSize: 14 }}>
              If you cancel now, {b.cancel_preview.refund_percent === 0 ? "no refund will be issued." : `you’ll receive a ${b.cancel_preview.refund_percent}% refund (₹${formatInr(b.cancel_preview.refund_amount)}).`}
            </Text>
          ) : (
            <Text style={{ color: colors.textSubtle, marginTop: 10, fontSize: 14 }}>This request is unpaid, so you can withdraw it at no charge.</Text>
          )}
          <GoldButton testID="cancel-booking" title={b.payment_status === "paid" ? "Cancel booking" : "Withdraw request"} onPress={confirmCancel} loading={cancelling} style={{ marginTop: spacing.lg }} />
        </Section>
      ) : null}

      {b.status === "completed" && (
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
