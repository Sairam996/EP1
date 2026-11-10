import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput, Platform, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { SuccessSeal, useCelebrate } from "@/src/components/Celebration";
import { colors, fonts, spacing, themedStyles, press } from "@/src/theme";
import { EyebrowLabel, KeyValue, Section, TextLink, editorialGold, gutter } from "@/src/components/ui";

export default function Checkout() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<any>(null);
  const [points, setPoints] = useState<{ balance: number } | null>(null);
  const [redeemInput, setRedeemInput] = useState("0");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ earned: number; redeemed: number; tier?: string; tier_up?: boolean; boost_pct?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const celebrate = useCelebrate();

  useEffect(() => {
    Promise.all([api.get(`/bookings/${bookingId}`), api.get("/me/points")])
      .then(([b, p]) => { setBooking(b); setPoints(p); });
  }, [bookingId]);

  const maxRedeem = booking ? Math.min(points?.balance || 0, Math.floor(booking.amount * 0.20)) : 0;
  const redeem = Math.max(0, Math.min(parseInt(redeemInput || "0", 10) || 0, maxRedeem));

  const pay = async () => {
    setPaying(true); setErr(null);
    try {
      const order = await api.post("/payments/order", { booking_id: bookingId, redeem_points: redeem });
      // In live mode (order.mode === "live"), this is where we'd launch Razorpay Checkout via WebView/JS-SDK.
      // For mock mode, we simulate the success callback. Same /verify works for both — only the signature check toggles server-side.
      const paymentId = order.mode === "live" ? `pay_${Date.now()}` : `pay_mock_${Date.now()}`;
      const verify = await api.post("/payments/verify", {
        booking_id: bookingId,
        razorpay_order_id: order.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: order.mode === "live" ? "TODO_real_signature_from_checkout_callback" : "mock_signature",
      });
      if (verify.success) {
        setDone({
          earned: verify.earned_points || 0,
          redeemed: verify.redeemed_points || 0,
          tier: verify.tier,
          tier_up: verify.tier_up,
          boost_pct: verify.boost_pct,
        });
        celebrate({ intensity: "big" });
        // Second wave for a tier upgrade.
        if (verify.tier_up) setTimeout(() => celebrate({ intensity: "light", title: `You\u2019re now ${verify.tier}`, subtitle: "Tier upgraded \u2014 more points on every booking.", icon: "trophy", haptic: false }), 1400);
      }
    } catch (e: any) { setErr(e.message); }
    finally { setPaying(false); }
  };

  if (!booking) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <SuccessSeal testID="booking-success-seal" />
        <Text style={styles.successTitle}>Booking Confirmed</Text>
        <Text style={{ color: colors.textSubtle, textAlign: "center", marginTop: 8 }}>Your booking with {booking.vendor_name} is confirmed.</Text>
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
        {done.redeemed > 0 && <Text style={{ color: colors.textMuted, marginTop: 8 }}>Used {done.redeemed} points (₹{done.redeemed} off)</Text>}
        <GoldButton testID="done-btn" title="View My Bookings" onPress={() => router.dismissTo("/(customer)/bookings")} style={{ marginTop: spacing.xl, minWidth: 240 }} />
      </View>
    );
  }

  const tax = Math.round(booking.amount * 0.05);
  const finalAmt = Math.max(0, booking.amount - redeem);
  const total = finalAmt + tax;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ opacity: pressed ? press.opacity - 0.25 : 1 })}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Checkout</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: gutter, marginTop: spacing.md }}>
          <EyebrowLabel>Order summary</EyebrowLabel>
          <Text style={styles.vendor} numberOfLines={2}>{booking.vendor_name}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, textTransform: "capitalize" }}>{String(booking.event_type || "").replace(/_/g, " ")}  ·  {booking.event_date}  ·  {booking.guests} guests</Text>
        </View>
        {(points?.balance || 0) > 0 && (
          <Section eyebrow="Thara Points">
            <Text style={{ color: colors.textSubtle, fontSize: 13 }}>
              Available <Text style={{ color: editorialGold(colors), fontWeight: "700" }}>{points?.balance}</Text>  ·  up to {maxRedeem} usable (20%)
            </Text>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 10, alignItems: "center" }}>
              <TextInput testID="redeem-input" value={redeemInput} onChangeText={setRedeemInput} keyboardType="number-pad"
                style={styles.redeemInput} placeholder="0" placeholderTextColor={colors.textMuted} />
              <TextLink testID="redeem-max" title="Use Max" onPress={() => setRedeemInput(String(maxRedeem))} />
            </View>
          </Section>
        )}
        <Section eyebrow="Price breakdown">
          <KeyValue label="Service" value={`₹${booking.amount.toLocaleString("en-IN")}`} />
          {redeem > 0 && <KeyValue label={`Points (−${redeem})`} value={`−₹${redeem.toLocaleString("en-IN")}`} valueColor={colors.success} />}
          <KeyValue label="GST (5%)" value={`₹${tax.toLocaleString("en-IN")}`} />
          <KeyValue label="Total" value={`₹${total.toLocaleString("en-IN")}`} emphasis valueColor={editorialGold(colors)} last />
          <Text style={{ color: colors.success, fontSize: 12, marginTop: 2 }}>
            You&apos;ll earn ~{Math.round(finalAmt * 0.05)} points on this booking
          </Text>
        </Section>
        <View style={styles.upi}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Secure UPI payment via Razorpay {Platform.OS === "web" ? "(test mode)" : ""}</Text>
        </View>
        {err && <Text style={{ color: colors.error, marginTop: 8, paddingHorizontal: gutter }}>{err}</Text>}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GoldButton testID="pay-btn" title={`Pay ₹${total.toLocaleString("en-IN")} via UPI`} icon="card" onPress={pay} loading={paying} />
      </View>
    </View>
  );
}
const styles = themedStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.displayBold },
  vendor: { color: colors.text, fontSize: 32, lineHeight: 38, fontFamily: fonts.displayBold, marginTop: 6 },
  upi: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xxl },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  successTitle: { color: colors.text, fontSize: 30, fontFamily: fonts.displayBold, letterSpacing: 0.3, marginTop: spacing.lg },
  earnedCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, alignSelf: "stretch", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  redeemInput: { flex: 1, backgroundColor: colors.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, fontSize: 16 },
}));
