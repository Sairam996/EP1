import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { SuccessSeal, useCelebrate } from "@/src/components/Celebration";
import { fonts, spacing, useColors } from "@/src/theme";
import { Divider, EyebrowLabel, KeyValue, TextLink, editorialGold, gutter } from "@/src/components/ui";
import { NumText } from "@/src/components/Num";
import { formatInr } from "@/src/utils/price";
import { prettyDate } from "@/src/payments/methods";

type Status = "success" | "failure" | "pending";
const POLL_MS = 4000;
const POLL_LIMIT = 45; // ~3 minutes

export default function PaymentResult() {
  const p = useLocalSearchParams<{ bookingId: string; status?: string; kind?: string; method?: string; amount?: string; earned?: string; redeemed?: string; pid?: string; reason?: string; tier_up?: string }>();
  const bookingId = p.bookingId;
  const kind = p.kind === "balance" ? "balance" : "advance";
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const gold = editorialGold(colors);
  const celebrate = useCelebrate();
  const [status, setStatus] = useState<Status>(p.status === "success" ? "success" : p.status === "failure" ? "failure" : "pending");
  const [booking, setBooking] = useState<any>(null);
  const [reason, setReason] = useState(p.reason || "");
  const [paid, setPaid] = useState<{ amount?: number; pid?: string }>({ amount: p.amount ? Number(p.amount) : undefined, pid: p.pid });
  const [polls, setPolls] = useState(0);
  const celebrated = useRef(false);

  const loadBooking = useCallback(async () => {
    try { setBooking(await api.get(`/bookings/${bookingId}`)); } catch { /* shown without details */ }
  }, [bookingId]);
  useEffect(() => { loadBooking(); }, [loadBooking, status]);

  useEffect(() => {
    if (status === "success" && !celebrated.current) {
      celebrated.current = true;
      celebrate({ intensity: kind === "balance" ? "light" : "big" });
      if (p.tier_up) setTimeout(() => celebrate({ intensity: "light", title: `You’re now ${p.tier_up}`, subtitle: "Tier upgraded — more points on every booking.", icon: "trophy", haptic: false }), 1400);
    }
  }, [status, kind, celebrate, p.tier_up]);

  const check = useCallback(async () => {
    try {
      const s = await api.get(`/payments/status/${bookingId}?kind=${kind}`);
      if (s.status === "paid") { setPaid({ amount: s.amount ?? s.paid_amount, pid: s.payment_id }); setStatus("success"); }
      else if (s.status === "failed") { setReason(s.reason || "Payment failed"); setStatus("failure"); }
    } catch { /* keep waiting */ }
    setPolls((n) => n + 1);
  }, [bookingId, kind]);

  useEffect(() => {
    if (status !== "pending" || polls >= POLL_LIMIT) return;
    const t = setTimeout(check, polls === 0 ? 1200 : POLL_MS);
    return () => clearTimeout(t);
  }, [status, polls, check]);

  const vendor = booking?.vendor_name || "your Partner";
  const toBooking = () => router.replace(`/booking-detail/${bookingId}` as any);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: gutter, paddingTop: insets.top + spacing.xl, paddingBottom: 140 }}>
        {status === "success" ? (
          <View testID="pay-success" style={{ alignItems: "center" }}>
            <SuccessSeal testID="booking-success-seal" />
            <EyebrowLabel style={{ marginTop: spacing.xl }}>Payment successful</EyebrowLabel>
            <Text style={titleStyle(colors.text)}>{kind === "balance" ? "Balance settled" : "Your date is locked"}</Text>
            <NumText style={{ color: colors.textSubtle, textAlign: "center", marginTop: 10, fontSize: 15, lineHeight: 22 }}>
              {kind === "balance"
                ? `Everything is paid to ${vendor}. Enjoy the celebration.`
                : `${vendor} has your 20% advance.${booking ? ` The balance of ₹${formatInr(booking.balance_amount)} is due on ${prettyDate(booking.event_date)}.` : ""}`}
            </NumText>
          </View>
        ) : status === "failure" ? (
          <View testID="pay-failure" style={{ alignItems: "center" }}>
            <Ionicons name="close-circle-outline" size={72} color={gold} />
            <EyebrowLabel style={{ marginTop: spacing.xl }}>Payment failed</EyebrowLabel>
            <Text style={titleStyle(colors.text)}>That didn&apos;t go through</Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center", marginTop: 10, fontSize: 15, lineHeight: 22 }}>{reason || "The payment was declined."}</Text>
            <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 10, fontSize: 13, lineHeight: 19 }}>
              If money left your account, your bank returns it automatically within 5–7 working days. Your booking is still held.
            </Text>
          </View>
        ) : (
          <View testID="pay-pending" style={{ alignItems: "center" }}>
            {polls < POLL_LIMIT ? <ActivityIndicator size="large" color={gold} /> : <Ionicons name="time-outline" size={64} color={gold} />}
            <EyebrowLabel style={{ marginTop: spacing.xl }}>Payment pending</EyebrowLabel>
            <Text style={titleStyle(colors.text)}>{polls < POLL_LIMIT ? "Confirming with your bank" : "Still waiting on your bank"}</Text>
            <Text style={{ color: colors.textSubtle, textAlign: "center", marginTop: 10, fontSize: 15, lineHeight: 22 }}>
              {polls < POLL_LIMIT
                ? "If you approved it in your UPI app, this usually takes under a minute. Please don't pay again."
                : "We'll update your booking the moment the bank confirms. If it fails, any amount taken is refunded automatically."}
            </Text>
          </View>
        )}

        <View style={{ marginTop: spacing.xxl }}>
          <Divider />
          <KeyValue label={kind === "balance" ? "Balance" : "Advance (20%)"} value={paid.amount != null ? `₹${formatInr(paid.amount)}` : booking ? `₹${formatInr(kind === "balance" ? booking.balance_amount : booking.advance_charged ?? booking.advance_amount)}` : "—"} emphasis valueColor={status === "success" ? gold : undefined} />
          <KeyValue label="Partner" value={<Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{vendor}</Text>} />
          {p.method ? <KeyValue label="Method" value={<Text style={{ color: colors.text, fontSize: 14 }}>{p.method}</Text>} /> : null}
          {status === "success" && paid.pid ? <KeyValue label="Reference" value={paid.pid.length > 18 ? `…${paid.pid.slice(-14)}` : paid.pid} /> : null}
          {status === "success" && Number(p.earned) > 0 ? <KeyValue label="Thara Points earned" value={`+${p.earned}`} valueColor={colors.success} /> : null}
          {status === "success" && kind === "advance" && booking ? <KeyValue label={`Balance due · ${prettyDate(booking.event_date)}`} value={`₹${formatInr(booking.balance_amount)}`} last /> : <Divider />}
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 12, backgroundColor: colors.surface }}>
        {status === "failure" ? (
          <GoldButton testID="retry-pay" title="Try again" onPress={() => router.replace(`/checkout/${bookingId}?kind=${kind}` as any)} />
        ) : (
          <GoldButton testID="view-booking" title="View booking" onPress={toBooking} />
        )}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 28, marginTop: 6 }}>
          {status === "failure" ? <TextLink title="Back to booking" onPress={toBooking} color={colors.textMuted} /> : null}
          {status === "pending" && polls >= POLL_LIMIT ? <TextLink testID="check-again" title="Check again" onPress={() => setPolls(0)} /> : null}
          {status === "success" ? <TextLink testID="all-bookings" title="All bookings" onPress={() => router.dismissTo("/(customer)/bookings")} color={colors.textMuted} /> : null}
        </View>
      </View>
    </View>
  );
}

const titleStyle = (color: string) => ({ color, fontSize: 32, lineHeight: 38, fontFamily: fonts.displayBold, marginTop: 8, textAlign: "center" as const });
