import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Animated, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { api, resolveImg } from "@/src/api";
import { Image } from "expo-image";
import { GoldButton, GhostButton, Pill } from "@/src/components/UI";
import { formatInr, formatPrice, previewTotals } from "@/src/utils/price";
import { PressableScale, SoftChip } from "@/src/components/Polish";
import { fonts, spacing, type, press, useThemedStyles, useColors } from "@/src/theme";
import { editorialGold } from "@/src/components/ui";
import { Num, NumText, numeric } from "@/src/components/Num";
import { PolicyInfo } from "@/src/components/PolicyInfo";
import { TharaProBadge } from "@/src/components/TharaProBadge";
import { SeeTheirWork } from "@/src/components/SeeTheirWork";

const EVENT_TYPES = ["wedding", "sangeet", "haldi", "mehendi", "reception", "birthday", "corporate", "engagement"];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const prettyDate = (s: string) => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" }); };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type StepKey = "package" | "event" | "date" | "guests" | "notes" | "review";

export default function BookingForm() {
  const { vendorId, serviceId: initialService } = useLocalSearchParams<{ vendorId: string; serviceId?: string }>();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const [vendor, setVendor] = useState<any>(null);
  const [eventType, setEventType] = useState("wedding");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("100");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(initialService || null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    api.get(`/vendors/${vendorId}`, { auth: false }).then(setVendor).catch(console.warn);
    api.get(`/vendors/${vendorId}/services`, { auth: false }).then((s) => {
      setServices(s || []);
      if (!initialService && s?.length === 1) setServiceId(s[0].id);
    }).catch(() => {});
    api.get(`/vendors/${vendorId}/availability`, { auth: false })
      .then((a) => setUnavailable([...(a.blocked_dates || []), ...(a.full_dates || [])])).catch(() => {});
  }, [vendorId, initialService]);

  const steps: StepKey[] = useMemo(() => [...(services.length > 0 ? ["package" as const] : []), "event", "date", "guests", "notes", "review"], [services.length]);
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const selected = services.find((s) => s.id === serviceId);
  const amount = Number(selected ? selected.price : vendor?.starting_price) > 0 ? Number(selected ? selected.price : vendor?.starting_price) : 0;

  const valid = (k: StepKey) => {
    if (k === "date") return !!date && !unavailable.includes(date);
    if (k === "guests") return parseInt(guests || "0", 10) > 0;
    return true;
  };

  const go = (dir: 1 | -1) => {
    setErr(null);
    if (dir === -1 && stepIdx === 0) { router.back(); return; }
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setStepIdx((i) => Math.max(0, Math.min(steps.length - 1, i + dir)));
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const submit = async () => {
    setErr(null);
    if (!date) { setErr("Please pick a date"); return; }
    if (unavailable.includes(date)) { setErr("This date is unavailable — please pick another"); return; }
    setLoading(true);
    try {
      const b = await api.post("/bookings", {
        vendor_id: vendorId, event_type: eventType, event_date: date,
        guests: parseInt(guests || "1", 10), notes, amount, service_id: serviceId || undefined,
      });
      router.replace(`/booking-detail/${b.id}`);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const s = useThemedStyles((p) => ({
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    title: { color: p.text, fontSize: 19, lineHeight: 23, fontFamily: fonts.displayBold },
    sub: { ...type.caption, color: p.textMuted, letterSpacing: 1.4, textTransform: "uppercase", fontSize: 10.5 },
    // Hairline progress: thin gold line fills step by step.
    progTrack: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
    seg: { flex: 1, height: 2, borderRadius: 1, backgroundColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    q: { color: p.text, fontSize: 32, lineHeight: 38, fontFamily: fonts.displayBold, marginBottom: 6, marginTop: spacing.md },
    hint: { ...type.body, color: p.textMuted, marginBottom: spacing.xl },
    vendorRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    vAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: p.surface3 },
    pkg: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    pkgImg: { width: 64, height: 64, borderRadius: 14 },
    input: { backgroundColor: p.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: p.text, fontSize: 15 },
    calWrap: { paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    stepBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.5)" : "rgba(140,106,38,0.5)", alignItems: "center", justifyContent: "center" },
    bigNum: { color: p.text, fontSize: 52, fontWeight: "600", minWidth: 140, textAlign: "center", ...numeric },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    rowL: { ...type.caption, color: p.textMuted, textTransform: "uppercase", letterSpacing: 1 },
    rowV: { ...type.body, color: p.text, fontWeight: "500" },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingTop: 12, backgroundColor: p.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)", flexDirection: "row", alignItems: "center", gap: 10 },
  }));

  const g = parseInt(guests || "0", 10) || 0;
  const setG = (n: number) => setGuests(String(Math.max(1, n)));
  const marked: any = {
    ...Object.fromEntries(unavailable.map((d) => [d, { disabled: true, disableTouchEvent: true }])),
    ...(date ? { [date]: { selected: true, selectedColor: c.brand, selectedTextColor: c.onBrand } } : {}),
  };

  const Review = ({ icon, label, value, to }: { icon: any; label: string; value: string; to: StepKey }) => (
    <PressableScale style={s.row} onPress={() => setStepIdx(steps.indexOf(to))} accessibilityLabel={`Edit ${label}`}>
      <Ionicons name={icon} size={18} color={c.brand} />
      <View style={{ flex: 1 }}><Text style={s.rowL}>{label}</Text><NumText style={s.rowV} numberOfLines={3}>{value}</NumText></View>
      <Ionicons name="create-outline" size={16} color={c.textMuted} />
    </PressableScale>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => go(-1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ opacity: pressed ? press.opacity - 0.25 : 1 })}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Book {vendor?.name ?? ""}</Text>
          <NumText style={s.sub}>Step {stepIdx + 1} of {steps.length}</NumText>
        </View>
        {amount > 0 ? <Num style={{ color: editorialGold(c), fontSize: 19, fontWeight: "600" }}>{formatPrice(amount, selected?.price_unit || vendor?.price_unit)}</Num> : <Text style={{ color: editorialGold(c), fontFamily: fonts.displayBold, fontSize: 19 }}>Price on request</Text>}
      </View>
      <View style={s.progTrack}>
        {steps.map((k, i) => <View key={k} style={[s.seg, i <= stepIdx && { backgroundColor: c.brand }]} />)}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fade }}>
          {step === "package" && (<>
            <Text style={s.q}>Choose a package</Text>
            <Text style={s.hint}>Pick what fits — or skip for a custom quote.</Text>
            <View>
              {services.map((sv) => {
                const on = sv.id === serviceId;
                return (
                  <PressableScale key={sv.id} testID={`pkg-${sv.id}`} onPress={() => setServiceId(on ? null : sv.id)}
                    style={s.pkg}>
                    {sv.photos?.[0] ? <Image source={{ uri: resolveImg(sv.photos[0]) }} style={s.pkgImg} contentFit="cover" transition={200} />
                      : <View style={[s.pkgImg, { backgroundColor: c.surface3, alignItems: "center", justifyContent: "center" }]}><Ionicons name="pricetag-outline" size={20} color={c.brand} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: on ? editorialGold(c) : c.text, fontFamily: fonts.displayBold, fontSize: 19 }} numberOfLines={1}>{sv.title}</Text>
                      {sv.description ? <Text style={{ color: c.textMuted, fontSize: 12 }} numberOfLines={2}>{sv.description}</Text> : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Num style={{ color: c.text, fontWeight: "600" }}>{formatPrice(sv.price, sv.price_unit || vendor?.price_unit)}</Num>
                      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? c.brand : c.textMuted} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
            <SeeTheirWork vendor={vendor} service={selected} style={{ marginTop: spacing.lg }} />
          </>)}

          {step === "event" && (<>
            <Text style={s.q}>What&apos;s the occasion?</Text>
            <Text style={s.hint}>We&apos;ll tailor the booking to your event.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 22, rowGap: 6 }}>
              {EVENT_TYPES.map((et) => <Pill key={et} label={cap(et)} active={eventType === et} onPress={() => setEventType(et)} testID={`et-${et}`} />)}
            </View>
          </>)}

          {step === "date" && (<>
            <Text style={s.q}>Pick your date</Text>
            <Text style={s.hint}>{unavailable.length ? "Greyed-out dates are already booked." : "All upcoming dates are open."}</Text>
            <View style={s.calWrap} testID="booking-date-field">
              <Calendar
                minDate={todayStr()}
                current={date || undefined}
                markedDates={marked}
                onDayPress={(d: any) => {
                  if (unavailable.includes(d.dateString)) return;
                  setDate(d.dateString);
                  setTimeout(() => go(1), 260); // continue smoothly after choosing
                }}
                enableSwipeMonths
                theme={{
                  calendarBackground: "transparent", backgroundColor: "transparent", textSectionTitleColor: c.textMuted,
                  monthTextColor: c.text, arrowColor: c.brand, todayTextColor: c.brand, dayTextColor: c.text,
                  textDisabledColor: c.mode === "dark" ? "#4A453C" : "#C9C2B2", selectedDayBackgroundColor: c.brand,
                  selectedDayTextColor: c.onBrand, textDayFontWeight: "500", textMonthFontWeight: "600",
                } as any}
              />
            </View>
            {date ? <View style={{ marginTop: spacing.md }}><SoftChip icon="calendar" label={prettyDate(date)} /></View> : null}
          </>)}

          {step === "guests" && (<>
            <Text style={s.q}>How many guests?</Text>
            <Text style={s.hint}>An estimate is fine — you can refine it later.</Text>
            <View style={s.stepper}>
              <PressableScale style={s.stepBtn} onPress={() => setG(g - 10)} accessibilityLabel="Fewer guests"><Ionicons name="remove" size={22} color={c.brand} /></PressableScale>
              <TextInput testID="booking-guests" value={guests} onChangeText={(t) => setGuests(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" style={s.bigNum} />
              <PressableScale style={s.stepBtn} onPress={() => setG(g + 10)} accessibilityLabel="More guests"><Ionicons name="add" size={22} color={c.brand} /></PressableScale>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 22, marginTop: spacing.lg, justifyContent: "center" }}>
              {[50, 100, 200, 300, 500].map((n) => <Pill key={n} label={`${n}`} active={g === n} onPress={() => setG(n)} />)}
            </View>
          </>)}

          {step === "notes" && (<>
            <Text style={s.q}>Anything special?</Text>
            <Text style={s.hint}>Optional — themes, timings, dietary needs.</Text>
            <TextInput testID="booking-notes" value={notes} onChangeText={setNotes} placeholder="Any special requests..."
              placeholderTextColor={c.textMuted} style={[s.input, { height: 140, textAlignVertical: "top" }]} multiline />
          </>)}

          {step === "review" && (<>
            <Text style={s.q}>Review & confirm</Text>
            <Text style={s.hint}>Tap any line to change it.</Text>
            {vendor && (
              <View style={s.vendorRow}>
                {vendor.gallery?.[0] ? <Image source={{ uri: resolveImg(vendor.gallery[0]) }} style={s.vAvatar} contentFit="cover" /> : <View style={s.vAvatar} />}
                <View style={{ flex: 1 }}><Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 21 }}>{vendor.name}</Text><Text style={s.sub}>{vendor.city} • {vendor.category}</Text></View>
                {vendor.verified ? <TharaProBadge /> : null}
              </View>
            )}
            {services.length > 0 && <Review icon="pricetag-outline" label="Package" value={selected?.title ?? "Custom quote"} to="package" />}
            <Review icon="sparkles-outline" label="Occasion" value={cap(eventType)} to="event" />
            <Review icon="calendar-outline" label="Date" value={prettyDate(date) || "Not chosen"} to="date" />
            <Review icon="people-outline" label="Guests" value={guests || "—"} to="guests" />
            <Review icon="document-text-outline" label="Notes" value={notes || "None"} to="notes" />
            <View style={[s.row, { borderBottomWidth: 0, flexDirection: "column", alignItems: "stretch", gap: 6 }]}>
              {amount > 0 ? (() => {
                const tot = previewTotals(amount);
                return (
                  <View testID="advance-preview">
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[s.rowV, { flex: 0 }]}>Service</Text>
                      <Num style={s.sub}>₹{formatInr(tot.service)}</Num>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={s.sub}>GST (5%)</Text>
                      <Num style={s.sub}>₹{formatInr(tot.gst)}</Num>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, alignItems: "baseline" }}>
                      <Text style={[s.rowV, { flex: 0 }]}>Total</Text>
                      <Num style={{ color: editorialGold(c), fontSize: 26, fontWeight: "600" }}>₹{formatInr(tot.total)}</Num>
                    </View>
                    <NumText style={{ color: editorialGold(c), marginTop: 12, fontSize: 16, fontFamily: fonts.display, lineHeight: 22 }} testID="advance-split">
                      Pay 20% now: ₹{formatInr(tot.advance)}  ·  Balance ₹{formatInr(tot.balance)} on event day
                    </NumText>
                    <Text style={{ color: c.textSubtle, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                      After the partner accepts, a 20% advance locks the date. The balance can be paid in the app or directly to the partner from the event date.
                    </Text>
                  </View>
                );
              })() : (
                <Text style={{ color: editorialGold(c), fontSize: 24, fontFamily: fonts.displayBold }}>Price on request</Text>
              )}
              <PolicyInfo />
            </View>
          </>)}
          {err ? <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md }}><Ionicons name="alert-circle" size={16} color={c.error} /><Text style={{ color: c.error, flex: 1 }}>{err}</Text></View> : null}
        </Animated.View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {stepIdx > 0 && <GhostButton title="Back" onPress={() => go(-1)} style={{ flex: 1 }} />}
        <View style={{ flex: 2 }}>
          {step === "review"
            ? <GoldButton testID="submit-booking" title="Send request" onPress={submit} loading={loading} disabled={!date} />
            : <GoldButton testID="booking-next" title={step === "package" && !serviceId ? "Skip" : step === "notes" && !notes ? "Skip" : "Next"} onPress={() => go(1)} disabled={!valid(step)} />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
