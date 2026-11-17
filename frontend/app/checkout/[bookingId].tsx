import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image, type ImageSourcePropType } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { fonts, spacing, themedStyles, press, useColors } from "@/src/theme";
import { Divider, EyebrowLabel, KeyValue, Section, SerifTitle, TextLink, editorialGold, gutter } from "@/src/components/ui";
import { formatInr } from "@/src/utils/price";
import { NumText } from "@/src/components/Num";
import { PolicyInfo } from "@/src/components/PolicyInfo";
import { RazorpayCheckoutModal, type RazorpayFailure, type RazorpayOrder, type RazorpaySuccess } from "@/src/components/RazorpayCheckout";
import { MockPaymentSheet, type MockOutcome } from "@/src/components/MockPaymentSheet";
import {
  PAY_LATER, POPULAR_BANKS, UPI_APPS, WALLETS, buildRazorpayConfig, isValidVpa, loadLastSelection,
  prettyDate, saveLastSelection, selectionKey, selectionLabel, type PaySelection, type SavedCard,
} from "@/src/payments/methods";
import { BANK_LOGOS, CARD_NETWORKS, PAY_LATER_LOGOS, UPI_APP_LOGOS, UPI_LOGO, WALLET_LOGOS, cardNetworkLogo } from "@/src/payments/logos";

type Breakdown = {
  service: number; gst: number; gst_rate: number; subtotal: number; total: number;
  advance_amount: number; balance_amount: number; charge: number;
  points_available: number; max_redeem: number; points_redeemed: number; earn_estimate: number;
  cancellation_policy?: string; payable?: boolean; blocked_reason?: string | null;
  status?: string; display_status?: string; kind?: "advance" | "balance"; mode?: string; event_date?: string;
};
type Order = RazorpayOrder & { mode: string; kind: "advance" | "balance" };

export default function Checkout() {
  const { bookingId, kind: kindParam } = useLocalSearchParams<{ bookingId: string; kind?: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const gold = editorialGold(colors);
  const requestedKind = kindParam === "balance" ? "balance" : kindParam === "advance" ? "advance" : undefined;
  const [booking, setBooking] = useState<any>(null);
  const [quote, setQuote] = useState<Breakdown | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [sel, setSel] = useState<PaySelection | null>(null);
  const [vpa, setVpa] = useState("");
  const [vpaOpen, setVpaOpen] = useState(false);
  const [redeemInput, setRedeemInput] = useState("0");
  const [paying, setPaying] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [mockOpen, setMockOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const payload: any = { booking_id: bookingId, redeem_points: 0 };
    if (requestedKind) payload.kind = requestedKind;
    const [b, q, m, last] = await Promise.all([
      api.get(`/bookings/${bookingId}`),
      api.post("/payments/quote", payload),
      api.get("/payments/methods").catch(() => ({ saved_cards: [] })),
      loadLastSelection(),
    ]);
    setBooking(b); setQuote(q); setSavedCards(m?.saved_cards || []);
    const fallback: PaySelection = { method: "upi", app: "google_pay" };
    const initial = last || fallback;
    setSel(initial);
    if (initial.method === "upi" && initial.vpa) { setVpa(initial.vpa); setVpaOpen(true); }
  }, [bookingId, requestedKind]);

  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);

  const refreshQuote = async (raw: string) => {
    setRedeemInput(raw);
    const n = Math.max(0, parseInt(raw || "0", 10) || 0);
    try {
      setQuote(await api.post("/payments/quote", { booking_id: bookingId, redeem_points: n, kind: requestedKind || quote?.kind || "advance" }));
    } catch { /* keep last quote */ }
  };

  const effectiveSel: PaySelection | null = useMemo(() => {
    if (sel?.method === "upi" && vpaOpen) return { method: "upi", vpa };
    return sel;
  }, [sel, vpa, vpaOpen]);
  const vpaInvalid = vpaOpen && sel?.method === "upi" && !isValidVpa(vpa);

  const goResult = (status: "success" | "failure" | "pending", extra: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams({ status, kind: quote?.kind || "advance", method: selectionLabel(effectiveSel), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) });
    router.replace(`/payment-result/${bookingId}?${qs.toString()}` as any);
  };

  const verify = async (o: Order, r: RazorpaySuccess) => {
    const v = await api.post("/payments/verify", {
      booking_id: bookingId, kind: o.kind, method: effectiveSel?.method,
      razorpay_order_id: r.razorpay_order_id, razorpay_payment_id: r.razorpay_payment_id, razorpay_signature: r.razorpay_signature,
    });
    if (v.success) {
      goResult("success", { amount: v.paid_amount ?? Math.round(o.amount / 100), earned: v.earned_points, redeemed: v.redeemed_points, pid: v.payment_id, tier_up: v.tier_up ? v.tier : undefined });
    } else if (v.pending) {
      goResult("pending");
    } else {
      goResult("failure", { reason: "We couldn't confirm this payment." });
    }
  };

  const reportFailure = async (o: Order | null, f: RazorpayFailure) => {
    try { await api.post("/payments/failed", { booking_id: bookingId, kind: o?.kind || quote?.kind || "advance", razorpay_order_id: o?.order_id, reason: f.reason, code: f.code }); } catch { /* best effort */ }
    goResult("failure", { reason: f.reason });
  };

  const pay = async () => {
    if (!effectiveSel || vpaInvalid) { setErr(vpaInvalid ? "Enter a valid UPI ID, like name@okhdfcbank" : "Choose a payment method"); return; }
    setPaying(true); setErr(null); setNote(null);
    try {
      const redeem = Math.max(0, parseInt(redeemInput || "0", 10) || 0);
      const kind = quote?.kind || requestedKind || "advance";
      const o: Order = await api.post("/payments/create-order", { booking_id: bookingId, redeem_points: redeem, kind, method: effectiveSel.method });
      await saveLastSelection(effectiveSel);
      if (o.mode === "free") {
        await verify(o, { razorpay_order_id: o.order_id, razorpay_payment_id: "pay_points_only", razorpay_signature: "points" });
      } else if (o.mode === "mock") {
        setOrder(o); setMockOpen(true);
      } else {
        setOrder(o);
      }
    } catch (e: any) { setErr(e.message); }
    finally { setPaying(false); }
  };

  const onMock = async (outcome: MockOutcome) => {
    setMockOpen(false);
    const o = order; setOrder(null);
    if (!o) return;
    setPaying(true);
    try {
      if (outcome === "success") await verify(o, { razorpay_order_id: o.order_id, razorpay_payment_id: `pay_mock_${Date.now()}`, razorpay_signature: "mock_signature" });
      else if (outcome === "failure") await reportFailure(o, { reason: "Your bank declined this test payment.", code: "BAD_REQUEST_ERROR" });
      else goResult("pending");
    } catch (e: any) { setErr(e.message); }
    finally { setPaying(false); }
  };

  if (!booking || !quote || !sel) {
    return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}>{err ? <Text style={{ color: colors.error, textAlign: "center", padding: gutter }}>{err}</Text> : <ActivityIndicator color={colors.brand} />}</View>;
  }

  const kind = quote.kind || "advance";
  const isAdvance = kind === "advance";
  const canPay = quote.payable === true;
  const policy = quote.cancellation_policy || booking.cancel_preview?.policy;
  const key = selectionKey(effectiveSel);
  const testMode = quote.mode !== "razorpay_live";
  const eventType = String(booking.event_type || "").replace(/_/g, " ");
  const serviceLine = [booking.service_title || (eventType.charAt(0).toUpperCase() + eventType.slice(1)), prettyDate(booking.event_date), booking.guests ? `${booking.guests} guests` : null].filter(Boolean).join("  ·  ");

  const choose = (s: PaySelection, keepVpa = false) => { setSel(s); if (!keepVpa) setVpaOpen(false); setErr(null); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ opacity: pressed ? press.opacity - 0.25 : 1 })}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ flex: 1 }} />
        {testMode ? <Text testID="test-mode-tag" style={{ color: gold, fontSize: 10.5, letterSpacing: 2, fontWeight: "700" }}>TEST MODE</Text> : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 170 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: gutter, marginTop: spacing.sm }}>
          <EyebrowLabel>{isAdvance ? "20% advance · locks your date" : "Balance · event day"}</EyebrowLabel>
          <Text style={styles.vendor} numberOfLines={2}>{booking.vendor_name}</Text>
          <NumText style={{ color: colors.textMuted, marginTop: 4 }}>{serviceLine}</NumText>
        </View>

        <Section eyebrow="Order summary" style={{ marginTop: spacing.xl }}>
          <KeyValue label="Service" value={`₹${formatInr(quote.service)}`} />
          <KeyValue label={`GST (${Math.round((quote.gst_rate || 0.05) * 100)}%)`} value={`₹${formatInr(quote.gst)}`} />
          <KeyValue label="Total" value={`₹${formatInr(quote.total)}`} />
          {isAdvance && quote.points_redeemed > 0 ? <KeyValue label={`Thara Points (−${quote.points_redeemed})`} value={`−₹${formatInr(quote.points_redeemed)}`} valueColor={colors.success} /> : null}
          <KeyValue label={isAdvance ? "Advance (20%) · due now" : "Balance (80%) · due now"} value={`₹${formatInr(quote.charge)}`} emphasis valueColor={gold} />
          <KeyValue label={isAdvance ? `Balance later · ${prettyDate(booking.event_date)}` : "Advance paid"} value={`₹${formatInr(isAdvance ? quote.balance_amount : quote.advance_amount)}`} last />
          {isAdvance ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Pay the balance in the app or directly to the Partner on the day.</Text> : null}
          {canPay && quote.earn_estimate > 0 ? <NumText style={{ color: colors.success, fontSize: 12, marginTop: 6 }}>{`You'll earn about ${quote.earn_estimate} Thara Points`}</NumText> : null}
          <View style={{ marginTop: spacing.sm }}><PolicyInfo policy={policy} /></View>
        </Section>

        {!canPay ? (
          <Section eyebrow={booking.display_status || "Status"}>
            <Text style={{ color: colors.textSubtle, fontSize: 15, lineHeight: 22 }}>{quote.blocked_reason || "This payment isn't open yet."}</Text>
          </Section>
        ) : (
          <>
            {isAdvance && (quote.points_available || 0) > 0 ? (
              <Section eyebrow="Thara Points">
                <NumText style={{ color: colors.textSubtle, fontSize: 13 }}>{`${quote.points_available} available  ·  up to ${quote.max_redeem} usable now`}</NumText>
                <View style={{ flexDirection: "row", gap: 14, marginTop: 10, alignItems: "center" }}>
                  <TextInput testID="redeem-input" value={redeemInput} onChangeText={refreshQuote} keyboardType="number-pad"
                    style={styles.input} placeholder="0" placeholderTextColor={colors.textMuted} />
                  <TextLink testID="redeem-max" title="Use max" onPress={() => refreshQuote(String(quote.max_redeem))} />
                </View>
              </Section>
            ) : null}

            <View style={{ paddingHorizontal: gutter, marginTop: spacing.xxl + 6 }}>
              <SerifTitle size={28}>Pay with</SerifTitle>
            </View>

            <Section eyebrow="UPI" style={{ marginTop: spacing.lg }} testID="pm-upi">
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {UPI_APPS.map((a) => (
                  <Tile key={a.code} testID={`upi-${a.code}`} label={a.label} logo={UPI_APP_LOGOS[a.code]} on={key === `upi:${a.code}`} onPress={() => choose({ method: "upi", app: a.code })} />
                ))}
              </View>
              <Divider style={{ marginTop: spacing.lg }} />
              <Row testID="upi-id" title="Pay with UPI ID" subtitle="Approve the request in your UPI app" logo={UPI_LOGO}
                on={key === "upi:vpa"} onPress={() => { setSel({ method: "upi", vpa }); setVpaOpen(true); }} last={!vpaOpen} />
              {vpaOpen && sel.method === "upi" ? (
                <View style={{ paddingLeft: 50, paddingBottom: spacing.md }}>
                  <TextInput testID="upi-id-input" value={vpa} onChangeText={(t) => { setVpa(t.trim()); setErr(null); }} autoCapitalize="none" autoCorrect={false}
                    keyboardType="email-address" placeholder="yourname@okhdfcbank" placeholderTextColor={colors.textMuted} style={styles.input} />
                  {vpa.length > 3 && vpaInvalid ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>That doesn&apos;t look like a UPI ID</Text> : null}
                  <Divider style={{ marginTop: spacing.md }} />
                </View>
              ) : null}
            </Section>

            <Section eyebrow="Cards" testID="pm-cards">
              {savedCards.map((c) => (
                <Row key={`${c.network}${c.last4}`} testID={`card-${c.last4}`} title={`${c.network} •••• ${c.last4}`} subtitle={c.issuer ? `${c.issuer}${c.type ? ` · ${c.type}` : ""}` : "Saved card"}
                  logo={cardNetworkLogo(c.network)} icon="card-outline" on={key === `card:${c.network}:${c.last4}`} onPress={() => choose({ method: "card", saved: c })} />
              ))}
              <Row testID="card-new" title={savedCards.length ? "Add a new card" : "Credit or debit card"} subtitle="Saved securely by Razorpay"
                icon="card-outline" on={key === "card:new"} onPress={() => choose({ method: "card" })} last
                footer={
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }} accessibilityLabel="Visa, Mastercard, RuPay, American Express">
                    {CARD_NETWORKS.map((n) => (
                      <View key={n.code} style={{ width: 34, height: 22, borderRadius: 4, backgroundColor: "#FFFFFF", overflow: "hidden" }}>
                        <Image source={n.logo} style={{ width: 34, height: 22 }} resizeMode="contain" />
                      </View>
                    ))}
                  </View>
                } />
            </Section>

            <Section eyebrow="Net banking" testID="pm-netbanking">
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {POPULAR_BANKS.map((bk) => (
                  <Tile key={bk.code} testID={`nb-${bk.code}`} label={bk.short || bk.label} logo={BANK_LOGOS[bk.code]} variant="bank" on={key === `nb:${bk.code}`} onPress={() => choose({ method: "netbanking", bank: bk.code })} />
                ))}
              </View>
              <Divider style={{ marginTop: spacing.lg }} />
              <Row testID="nb-all" title="All other banks" subtitle="Choose from 50+ banks" icon="business-outline" on={key === "nb:all"} onPress={() => choose({ method: "netbanking" })} last />
            </Section>

            <Section eyebrow="Wallets" testID="pm-wallets">
              {WALLETS.map((w, i) => (
                <Row key={w.code} testID={`wallet-${w.code}`} title={w.label} logo={WALLET_LOGOS[w.code]} on={key === `wallet:${w.code}`} onPress={() => choose({ method: "wallet", wallet: w.code })} last={i === WALLETS.length - 1} />
              ))}
            </Section>

            <Section eyebrow="Pay later" testID="pm-paylater">
              {PAY_LATER.map((p, i) => (
                <Row key={p.code} testID={`pl-${p.code}`} title={p.label} subtitle="Subject to eligibility" logo={PAY_LATER_LOGOS[p.code]} on={key === `pl:${p.code}`} onPress={() => choose({ method: "paylater", provider: p.code })} last={i === PAY_LATER.length - 1} />
              ))}
            </Section>

            <View style={styles.trust}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 }}>
                Secured by Razorpay. Thara never sees your card number or UPI PIN.{testMode ? " Test mode: no real money is charged." : ""}
              </Text>
            </View>
          </>
        )}
        {note ? <Text style={{ color: colors.textMuted, marginTop: 8, paddingHorizontal: gutter }}>{note}</Text> : null}
        {err ? <Text testID="checkout-error" style={{ color: colors.error, marginTop: 8, paddingHorizontal: gutter }}>{err}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Divider />
        {canPay ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 12.5 }} numberOfLines={1}>{`Paying with ${selectionLabel(effectiveSel)}`}</Text>
              <PolicyChip label={isAdvance ? "Refundable as per policy" : "Final payment"} color={colors.textMuted} />
            </View>
            <GoldButton testID="pay-btn" title={`Pay ₹${formatInr(quote.charge)}`} onPress={pay} loading={paying} disabled={vpaInvalid} />
          </>
        ) : (
          <GoldButton testID="back-booking-btn" title="View booking" onPress={() => router.replace(`/booking-detail/${bookingId}` as any)} style={{ marginTop: 12 }} />
        )}
      </View>

      <RazorpayCheckoutModal
        visible={!!order && order.mode !== "mock" && order.mode !== "free"}
        order={order}
        {...(effectiveSel ? buildRazorpayConfig(effectiveSel) : {})}
        onSuccess={async (r) => { const o = order; setOrder(null); if (!o) return; setPaying(true); try { await verify(o, r); } catch (e: any) { setErr(e.message); } finally { setPaying(false); } }}
        onFailure={(f) => { const o = order; setOrder(null); reportFailure(o, f); }}
        onPending={() => { setOrder(null); goResult("pending"); }}
        onDismiss={() => { setOrder(null); setNote("Payment cancelled. You haven't been charged."); }}
      />
      <MockPaymentSheet visible={mockOpen} amount={quote.charge} methodLabel={selectionLabel(effectiveSel)} onResult={onMock}
        onClose={() => { setMockOpen(false); setOrder(null); setNote("Payment cancelled. You haven't been charged."); }} />
    </KeyboardAvoidingView>
  );
}

function Radio({ on }: { on: boolean }) {
  const colors = useColors();
  return <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? editorialGold(colors) : colors.textMuted} />;
}

/** White chip that carries an official brand mark unaltered; a gold ring shows the selection. */
function LogoChip({ source, on, w, h, round }: { source: ImageSourcePropType; on?: boolean; w: number; h: number; round?: boolean }) {
  const colors = useColors();
  const r = round ? (h + 6) / 2 : 9;
  return (
    <View style={{ padding: 2, borderRadius: r, borderWidth: 1.25, borderColor: on ? editorialGold(colors) : "transparent" }}>
      <View style={{ width: w, height: h, borderRadius: round ? h / 2 : 6, backgroundColor: "#FFFFFF", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <Image source={source} style={{ width: w, height: h }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    </View>
  );
}

/** Open radio row: brand chip/icon · title/subtitle · radio. Gold hairline below. */
function Row({ testID, title, subtitle, logo, icon, on, onPress, last, footer }: {
  testID: string; title: string; subtitle?: string; logo?: ImageSourcePropType; icon?: keyof typeof Ionicons.glyphMap;
  on: boolean; onPress: () => void; last?: boolean; footer?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View>
      <Pressable testID={testID} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={title}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
        <View style={{ width: 50, alignItems: "center" }}>
          {logo ? <LogoChip source={logo} on={on} w={42} h={28} /> : <Ionicons name={icon || "ellipse-outline"} size={22} color={on ? editorialGold(colors) : colors.textSubtle} />}
        </View>
        <View style={{ flex: 1 }}>
          <NumText style={{ color: colors.text, fontSize: 15.5, fontWeight: on ? "600" : "400" }}>{title}</NumText>
          {subtitle ? <NumText style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{subtitle}</NumText> : null}
          {footer}
        </View>
        <Radio on={on} />
      </Pressable>
      {last ? null : <Divider inset={66} />}
    </View>
  );
}

/** Logo tile for UPI apps (round) and popular banks (wordmark chip). */
function Tile({ testID, label, logo, on, onPress, variant = "round" }: {
  testID: string; label: string; logo: ImageSourcePropType; on: boolean; onPress: () => void; variant?: "round" | "bank";
}) {
  const colors = useColors();
  const round = variant === "round";
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={({ pressed }) => [{ alignItems: "center", width: round ? 74 : 66, gap: 7 }, pressed && { opacity: 0.6 }]}>
      {round ? <LogoChip source={logo} on={on} w={50} h={50} round /> : <LogoChip source={logo} on={on} w={58} h={36} />}
      <Text numberOfLines={1} style={{ color: on ? editorialGold(colors) : colors.textSubtle, fontSize: 11.5, fontWeight: on ? "600" : "400" }}>{label}</Text>
    </Pressable>
  );
}

function PolicyChip({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 11.5, fontStyle: "italic", fontFamily: fonts.display }}>{label}</Text>;
}

const styles = themedStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 22, fontFamily: fonts.displayBold },
  vendor: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold, marginTop: 6 },
  input: { flex: 1, backgroundColor: colors.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, fontSize: 16, fontVariant: ["tabular-nums", "lining-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: 16, minHeight: 58, paddingVertical: 10 },
  trust: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: gutter, marginTop: spacing.xxl },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, backgroundColor: colors.surface },
}));
