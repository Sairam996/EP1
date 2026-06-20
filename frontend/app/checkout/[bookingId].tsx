import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
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
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { api.get(`/bookings/${bookingId}`).then(setBooking).catch(console.warn); }, [bookingId]);

  const pay = async () => {
    setPaying(true);
    try {
      const order = await api.post("/payments/order", { booking_id: bookingId });
      // Mock UPI confirmation flow
      const verify = await api.post("/payments/verify", {
        booking_id: bookingId,
        razorpay_order_id: order.order_id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: "mock_signature",
      });
      if (verify.success) setDone(true);
    } catch (e: any) { alert(e.message); }
    finally { setPaying(false); }
  };

  if (!booking) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={styles.successCircle}><Ionicons name="checkmark" size={48} color={colors.onBrand} /></View>
        <Text style={styles.successTitle}>Payment Successful!</Text>
        <Text style={{ color: colors.textSubtle, textAlign: "center", marginTop: 8 }}>Your booking with {booking.vendor_name} is confirmed.</Text>
        <GoldButton testID="done-btn" title="View My Bookings" onPress={() => router.replace("/(customer)/bookings")} style={{ marginTop: spacing.xl, minWidth: 240 }} />
      </View>
    );
  }

  const tax = Math.round(booking.amount * 0.05);
  const total = booking.amount + tax;
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
        <View style={styles.card}>
          <Text style={styles.cardH}>Price Breakdown</Text>
          <Row k="Service" v={`₹${booking.amount.toLocaleString("en-IN")}`} />
          <Row k="GST (5%)" v={`₹${tax.toLocaleString("en-IN")}`} />
          <View style={styles.divider} />
          <Row k="Total" v={`₹${total.toLocaleString("en-IN")}`} bold />
        </View>
        <View style={styles.upi}>
          <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
          <Text style={{ color: colors.textSubtle, flex: 1 }}>Secure UPI payment via Razorpay (test mode)</Text>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GoldButton testID="pay-btn" title={`Pay ₹${total.toLocaleString("en-IN")} via UPI`} icon="card" onPress={pay} loading={paying} />
      </View>
    </View>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{k}</Text>
      <Text style={{ color: bold ? colors.brand : colors.text, fontWeight: bold ? "600" : "500", fontSize: bold ? 16 : 14 }}>{v}</Text>
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
});
