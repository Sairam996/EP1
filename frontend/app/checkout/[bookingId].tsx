import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { SuccessSeal, useCelebrate } from "@/src/components/Celebration";
import { fonts, spacing, themedStyles, press, useColors } from "@/src/theme";
import { EyebrowLabel, KeyValue, Section, TextLink, editorialGold, gutter } from "@/src/components/ui";
import { formatInr } from "@/src/utils/price";
import { RazorpayCheckoutModal, type RazorpayOrder, type RazorpaySuccess } from "@/src/components/RazorpayCheckout";

type Breakdown = {
  service: number;
  gst: number;
  gst_rate: number;
  subtotal: number;
  total: number;
  advance_amount: number;
  balance_amount: number;
  charge: number;
  points_available: number;
  max_redeem: number;
  points_redeemed: number;
  earn_estimate: number;
  cancellation_policy?: string;
  payable?: boolean;
  blocked_reason?: string | null;
  status?: string;
  payment_status?: string;
  display_status?: string;
  kind?: "advance" | "balance";
  mode?: string;
  event_date?: string;
  event_reached?: boolean;
};

export default function Checkout() {
  const { bookingId, kind: kindParam } = useLocalSearchParams<{ bookingId: string; kind?: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const requestedKind = kindParam === "balance" ? "balance" : kindParam === "advance" ? "advance" : undefined;
  const [booking, setBooking] = useState<any>(null);
  const [quote, setQuote] = useState<Breakdown | null>(null);
  const [redeemInput, setRedeemInput] = useState("0");
  const [paying, setPaying] = useState(false);
  const [liveOrder, setLiveOrder] = useState<RazorpayOrder | null>(null);
  const [done, setDone] = useState<{ kind: string; earned: number; redeemed: number; tier?: string; tier_up?: boolean; boost_pct?: number; balance_amount?: number; event_date?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const celebrate = useCelebrate();

  const load = useCallback(async (redeem = 0) => {
    const payload: any = { booking_id: bookingId, redeem_points: redeem };
    if (requestedKind) payload.kind = requestedKind;
    const [b, q] = await Promise.all([
      api.get(`/bookings/${bookingId}`),
      api.post("/payments/quote", payload),
    ]);
    setBooking(b);
    setQuote(q);
  }, [bookingId, requestedKind]);

  useEffect(() => { load(0).catch((e) => setErr(e.message)); }, [load]);

  const refreshQuote = async (raw: string) => {
    setRedeemInput(raw);
    const n = Math.max(0, parseInt(raw || "0", 10) || 0);
    try {
      const payload: any = { booking_id: bookingId, redeem_points: n, kind: requestedKind || quote?.kind || "advance" };
      setQuote(await api.post("/payments/quote", payload));
    } catch { /* keep last quote */ }
  };

  const finishSuccess = (verify: any) => {
    setDone({
      kind: verify.kind || quote?.kind || "advance",
      earned: verify.earned_points || 0,
      redeemed: verify.redeemed_points || 0,
      tier: verify.tier,
      tier_up: verify.tier_up,
      boost_pct: verify.boost_pct,
      balance_amount: verify.balance_amount ?? quote?.balance_amount,
      event_date: verify.event_date || booking?.event_date,
    });
    celebrate({ intensity: verify.kind === "balance" ? "light" : "big" });
    if (verify.tier_up) {
      setTimeout(() => celebrate({
        intensity: "light",
        title: `You’re now ${verify.tier}`,
        subtitle: "Tier upgraded — more points on every booking.",
        icon: "trophy",
        haptic: false,
      }), 1400);
    }
  };

  const verifyOrder = async (order: any, payment: { razorpay_payment_id: string; razorpay_signature: string }) => {
    const verify = await api.post("/payments/verify", {
      booking_id: bookingId,
      razorpay_order_id: order.order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
      kind: order.kind || quote?.kind || "advance",
    });
    if (verify.success) finishSuccess(verify);
    else setErr("Payment could not be verified");
  };

  const pay = async () => {
    setPaying(true); setErr(null);
    try {
      const redeem = Math.max(0, parseInt(redeemInput || "0", 10) || 0);
      const kind = quote?.kind || requestedKind || "advance";
      const order = await api.post("/payments/order", { booking_id: bookingId, redeem_points: redeem, kind });
      if (order.mode === "live") {
        setLiveOrder(order);
        return;
      }
      await verifyOrder(order, {
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: "mock_signature",
      });
    } catch (e: any) { setErr(e.message); }
    finally { setPaying(false); }
  };

  const onLiveSuccess = async (r: RazorpaySuccess) => {
    const order = liveOrder;
    setLiveOrder(null);
    if (!order) return;
    setPaying(true);
    try { await verifyOrder(order, r); }
    catch (e: any) { setErr(e.message); }
    finally { setPaying(false); }
  };

  if (!booking || !quote) {
    return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;
  }

  const kind = quote.kind || "advance";
  const isAdvance = kind === "advance";

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <SuccessSeal testID="booking-success-seal" />
        <Text style={styles.successTitle}>{done.kind === "balance" ? "Balance settled" : "Date locked"}</Text>
        <Text style={{ color: colors.textSubtle, textAlign: "center", marginTop: 8 }}>
          {done.kind === "balance"
            ? `The remaining balance with ${booking.vendor_name} is paid.`
            : `Your 20% advance with ${booking.vendor_name} is paid. The balance of ₹${formatInr(done.balance_amount || 0)} is due on ${done.event_date} — pay in the app or directly to the vendor.`}
        </Text>
        {done.earned > 0 && (
          <View style={styles.earnedCard} testID="earned-card">
            <Ionicons name="sparkles-outline" size={18} color={colors.brand} />
            <Text style={{ color: colors.brand, fontWeight: "600", textAlign: "center", flexShrink: 1 }}>
              +{done.earned} Thara Points earned
              {done.boost_pct ? ` (incl. +${done.boost_pct}% ${done.tier} bonus)` : ""}
            </Text>
          </View>
        )}
        {done.tier_up && (
          <View style={styles.earnedCard} testID="tier-up-banner">
            <Ionicons name="trophy-outline" size={18} color={colors.brand} />
            <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 19 }}>You&apos;ve leveled up to {done.tier}</Text>
          </View>
        )}
        {done.redeemed > 0 && <Text style={{ color: colors.textMuted, marginTop: 8 }}>Used {done.redeemed} points (₹{done.redeemed} off the advance)</Text>}
        <GoldButton testID="done-btn" title="View My Bookings" onPress={() => router.dismissTo("/(customer)/bookings")} style={{ marginTop: spacing.xl, minWidth: 240 }} />
      </View>
    );
  }

  const awaitingVendor = booking.status === "pending";
  const canPay = quote.payable === true;
  const policy = quote.cancellation_policy || booking.cancel_preview?.policy;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ opacity: pressed ? press.opacity - 0.25 : 1 })}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{isAdvance ? "Pay advance" : "Pay balance"}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: gutter, marginTop: spacing.md }}>
          <EyebrowLabel>Order summary</EyebrowLabel>
          <Text style={styles.vendor} numberOfLines={2}>{booking.vendor_name}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, textTransform: "capitalize" }}>
            {String(booking.event_type || "").replace(/_/g, " ")}  ·  {booking.event_date}  ·  {booking.guests} guests
          </Text>
        </View>

        {awaitingVendor ? (
          <Section eyebrow="Waiting for confirmation">
            <Text style={{ color: colors.textSubtle, fontSize: 15, lineHeight: 22 }}>
              Your request has been sent. The 20% advance opens after {booking.vendor_name} accepts the date.
            </Text>
          </Section>
        ) : null}

        {!canPay && quote.blocked_reason ? (
          <Section eyebrow={booking.display_status || "Status"}>
            <Text style={{ color: colors.textSubtle, fontSize: 15, lineHeight: 22 }}>{quote.blocked_reason}</Text>
          </Section>
        ) : null}

        {canPay && isAdvance && (quote.points_available || 0) > 0 && (
          <Section eyebrow="Thara Points">
            <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
              Available <Text style={{ color: editorialGold(colors), fontWeight: "700" }}>{quote.points_available}</Text>
              {"  ·  "}up to {quote.max_redeem} usable on the advance
            </Text>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 10, alignItems: "center" }}>
              <TextInput testID="redeem-input" value={redeemInput} onChangeText={refreshQuote} keyboardType="number-pad"
                style={styles.redeemInput} placeholder="0" placeholderTextColor={colors.textMuted} />
              <TextLink testID="redeem-max" title="Use Max" onPress={() => refreshQuote(String(quote.max_redeem))} />
            </View>
          </Section>
        )}

        <Section eyebrow="Price breakdown">
          <KeyValue label="Service" value={`₹${formatInr(quote.service)}`} />
          <KeyValue label={`GST (${Math.round((quote.gst_rate || 0.05) * 100)}%)`} value={`₹${formatInr(quote.gst)}`} />
          <KeyValue label="Total" value={`₹${formatInr(quote.total)}`} emphasis />
          <KeyValue label="Advance (20%)" value={`₹${formatInr(quote.advance_amount)}`} />
          {isAdvance && quote.points_redeemed > 0 && <KeyValue label={`Points (−${quote.points_redeemed})`} value={`−₹${formatInr(quote.points_redeemed)}`} valueColor={colors.success} />}
          {isAdvance
            ? <KeyValue label="Pay now" value={`₹${formatInr(quote.charge)}`} emphasis valueColor={editorialGold(colors)} />
            : <KeyValue label="Pay now (balance)" value={`₹${formatInr(quote.charge)}`} emphasis valueColor={editorialGold(colors)} />}
          <KeyValue
            label={isAdvance ? "Balance later" : "Balance"}
            value={isAdvance ? `₹${formatInr(quote.balance_amount)} on ${booking.event_date}` : `₹${formatInr(quote.balance_amount)}`}
            last
          />
          {canPay && quote.earn_estimate > 0 && (
            <Text style={{ color: colors.success, fontSize: 12, marginTop: 2 }}>
              You&apos;ll earn ~{quote.earn_estimate} points on this payment
            </Text>
          )}
        </Section>

        {policy ? (
          <Section eyebrow="Cancellation">
            <Text style={{ color: colors.textSubtle, fontSize: 13, lineHeight: 20 }} testID="cancel-policy">
              {policy}
            </Text>
          </Section>
        ) : null}

        <View style={styles.upi}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {quote.mode === "live" ? "Secure UPI payment via Razorpay" : "Secure UPI payment via Razorpay (test mode)"}
          </Text>
        </View>
        {err && <Text style={{ color: colors.error, marginTop: 8, paddingHorizontal: gutter }}>{err}</Text>}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {canPay ? (
          <GoldButton
            testID="pay-btn"
            title={isAdvance ? `Pay advance ₹${formatInr(quote.charge)}` : `Pay balance ₹${formatInr(quote.charge)}`}
            icon="card"
            onPress={pay}
            loading={paying}
          />
        ) : (
          <GoldButton testID="back-bookings-btn" title={awaitingVendor ? "View booking" : "Back to bookings"} onPress={() => router.dismissTo("/(customer)/bookings")} />
        )}
      </View>
      <RazorpayCheckoutModal
        visible={!!liveOrder}
        order={liveOrder}
        onSuccess={onLiveSuccess}
        onDismiss={() => { setLiveOrder(null); setPaying(false); }}
      />
    </View>
  );
}
const styles = themedStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.displayBold },
  vendor: { color: colors.text, fontSize: 32, lineHeight: 38, fontFamily: fonts.displayBold, marginTop: 6 },
  redeemInput: { flex: 1, backgroundColor: colors.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, fontSize: 16 },
  upi: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: gutter, marginTop: spacing.lg },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface },
  successTitle: { color: colors.text, fontSize: 28, fontFamily: fonts.displayBold, marginTop: spacing.lg, textAlign: "center" },
  earnedCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.lg, paddingHorizontal: 16, paddingVertical: 12 },
}));
