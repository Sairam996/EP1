import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Checkout() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<any>(null);
  const [points, setPoints] = useState<{ balance: number } | null>(null);
  const [redeemInput, setRedeemInput] = useState("0");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ earned: number; redeemed: number; tier?: string; tier_up?: boolean; boost_pct?: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      if (verify.success) setDone({
        earned: verify.earned_points || 0,
        redeemed: verify.redeemed_points || 0,
        tier: verify.tier,
        tier_up: verify.tier_up,
        boost_pct: verify.boost_pct,
      });
    } catch (e: any) { setErr(e.message); }
    finally { setPaying(false); }
  };

  if (!booking) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={styles.successCircle}><Ionicons name="checkmark" size={48} color={colors.onBrand} /></View>
        <Text style={styles.successTitle}>Payment Successful!</Text>
        <Text style={{ color: colors.textSubtle, textAlign: "center", marginTop: 8 }}>Your booking with {booking.vendor_name} is confirmed.</Text>
        {done.earned > 0 && (
          <View style={styles.earnedCard} testID="earned-card">
            <Ionicons name="sparkles" size={20} color={colors.brand} />
            <Text style={{ color: colors.brand, fontWeight: "600" }}>
              +{done.earned} EventPro Points earned
              {done.boost_pct ? ` (incl. +${done.boost_pct}% ${done.tier} bonus)` : ""}
            </Text>
          </View>
        )}
        {done.tier_up && (
          <View style={[styles.earnedCard, { backgroundColor: "#FFD70022", borderColor: "#FFD700" }]} testID="tier-up-banner">
            <Ionicons name="trophy" size={22} color="#FFD700" />
            <Text style={{ color: "#FFD700", fontWeight: "700" }}>🎉 You've leveled up to {done.tier}!</Text>
          </View>
        )}
        {done.redeemed > 0 && <Text style={{ color: colors.textMuted, marginTop: 8 }}>Used {done.redeemed} points (₹{done.redeemed} off)</Text>}
        <GoldButton testID="done-btn" title="View My Bookings" onPress={() => router.replace("/(customer)/bookings")} style={{ marginTop: spacing.xl, minWidth: 240 }} />
      </View>
    );
  }

  const tax = Math.round(booking.amount * 0.05);
  const finalAmt = Math.max(0, booking.amount - redeem);
  const total = finalAmt + tax;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Checkout</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }}>
        <View style={styles.card}>
          <Text style={styles.cardH}>Order Summary</Text>
          <Row k="Vendor" v={booking.vendor_name} />
          <Row k="Event" v={booking.event_type} />
          <Row k="Date" v={booking.event_date} />
          <Row k="Guests" v={String(booking.guests)} />
        </View>
        {(points?.balance || 0) > 0 && (
          <View style={[styles.card, { borderColor: colors.brand + "55" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="diamond" size={18} color={colors.brand} />
              <Text style={[styles.cardH, { marginBottom: 0 }]}>Redeem Points</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              Available: <Text style={{ color: colors.brand, fontWeight: "600" }}>{points?.balance}</Text> • Max usable: {maxRedeem} (20% off)
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
              <TextInput testID="redeem-input" value={redeemInput} onChangeText={setRedeemInput} keyboardType="number-pad"
                style={styles.redeemInput} placeholder="0" placeholderTextColor={colors.textMuted} />
              <Pressable testID="redeem-max" onPress={() => setRedeemInput(String(maxRedeem))} style={styles.maxBtn}>
                <Text style={{ color: colors.brand, fontWeight: "600" }}>Use Max</Text>
              </Pressable>
            </View>
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.cardH}>Price Breakdown</Text>
          <Row k="Service" v={`₹${booking.amount.toLocaleString("en-IN")}`} />
          {redeem > 0 && <Row k={`Points (-${redeem})`} v={`-₹${redeem.toLocaleString("en-IN")}`} discount />}
          <Row k="GST (5%)" v={`₹${tax.toLocaleString("en-IN")}`} />
          <View style={styles.divider} />
          <Row k="Total" v={`₹${total.toLocaleString("en-IN")}`} bold />
          <Text style={{ color: colors.success, fontSize: 11, marginTop: 4 }}>
            You'll earn ~{Math.round(finalAmt * 0.05)} points on this booking
          </Text>
        </View>
        <View style={styles.upi}>
          <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
          <Text style={{ color: colors.textSubtle, flex: 1, fontSize: 12 }}>Secure UPI payment via Razorpay {Platform.OS === "web" ? "(test mode)" : ""}</Text>
        </View>
        {err && <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text>}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GoldButton testID="pay-btn" title={`Pay ₹${total.toLocaleString("en-IN")} via UPI`} icon="card" onPress={pay} loading={paying} />
      </View>
    </View>
  );
}
function Row({ k, v, bold, discount }: { k: string; v: string; bold?: boolean; discount?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: bold ? colors.brand : discount ? colors.success : colors.text, fontWeight: bold ? "600" : "500", fontSize: bold ? 16 : 14 }}>{v}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  card: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardH: { color: colors.text, fontSize: 16, fontWeight: "500", marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 6 },
  upi: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, backgroundColor: colors.brandTint, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
  successCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  successTitle: { color: colors.text, fontSize: 24, fontWeight: "500", marginTop: spacing.lg },
  earnedCard: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTint },
  redeemInput: { flex: 1, backgroundColor: colors.surface3, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  maxBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
});
