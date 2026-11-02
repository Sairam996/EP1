import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Animated } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { api, resolveImg } from "@/src/api";
import { Image } from "expo-image";
import { GoldButton, GhostButton, Pill } from "@/src/components/UI";
import { PressableScale, SoftChip } from "@/src/components/Polish";
import { radius, spacing, type, press, useThemedStyles, useColors } from "@/src/theme";

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
      router.replace(`/checkout/${b.id}`);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const s = useThemedStyles((p) => ({
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    title: { color: p.text, fontSize: 18, fontWeight: "600" },
    sub: { ...type.caption, color: p.textMuted },
    progTrack: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: p.border },
    seg: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: p.surface3 },
    q: { ...type.h1, color: p.text, marginBottom: 4 },
    hint: { ...type.body, color: p.textMuted, marginBottom: spacing.xl },
    vendorRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.xl, padding: spacing.md, backgroundColor: p.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: p.border },
    vAvatar: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: p.surface3 },
    pkg: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, backgroundColor: p.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: p.border },
    pkgImg: { width: 52, height: 52, borderRadius: radius.sm },
    input: { backgroundColor: p.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, color: p.text, borderWidth: 1, borderColor: p.border, fontSize: 15 },
    calWrap: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: p.border, backgroundColor: p.surface2, paddingBottom: 6 },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: p.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: p.border },
    stepBtn: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: p.brandTint, alignItems: "center", justifyContent: "center" },
    bigNum: { color: p.text, fontSize: 32, fontWeight: "700", minWidth: 100, textAlign: "center" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: p.divider },
    rowL: { ...type.caption, color: p.textMuted, textTransform: "uppercase", letterSpacing: 1 },
    rowV: { ...type.body, color: p.text, fontWeight: "500" },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingTop: 12, backgroundColor: p.surface, borderTopWidth: 1, borderColor: p.border, flexDirection: "row", gap: 10 },
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
      <View style={{ flex: 1 }}><Text style={s.rowL}>{label}</Text><Text style={s.rowV} numberOfLines={3}>{value}</Text></View>
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
          <Text style={s.sub}>Step {stepIdx + 1} of {steps.length}</Text>
        </View>
        <Text style={{ color: c.brand, fontWeight: "700" }}>{amount > 0 ? `₹${amount.toLocaleString("en-IN")}` : "Price on request"}</Text>
      </View>
      <View style={s.progTrack}>
        {steps.map((k, i) => <View key={k} style={[s.seg, i <= stepIdx && { backgroundColor: c.brand }]} />)}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fade }}>
          {step === "package" && (<>
            <Text style={s.q}>Choose a package</Text>
            <Text style={s.hint}>Pick what fits — or skip for a custom quote.</Text>
            <View style={{ gap: 10 }}>
              {services.map((sv) => {
                const on = sv.id === serviceId;
                return (
                  <PressableScale key={sv.id} testID={`pkg-${sv.id}`} onPress={() => setServiceId(on ? null : sv.id)}
                    style={[s.pkg, on && { borderColor: c.brand, backgroundColor: c.brandTint }]}>
                    {sv.photos?.[0] ? <Image source={{ uri: resolveImg(sv.photos[0]) }} style={s.pkgImg} contentFit="cover" transition={200} />
                      : <View style={[s.pkgImg, { backgroundColor: c.surface3, alignItems: "center", justifyContent: "center" }]}><Ionicons name="pricetag-outline" size={20} color={c.brand} /></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: "600" }} numberOfLines={1}>{sv.title}</Text>
                      {sv.description ? <Text style={{ color: c.textMuted, fontSize: 12 }} numberOfLines={2}>{sv.description}</Text> : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: c.brand, fontWeight: "700" }}>₹{Number(sv.price).toLocaleString("en-IN")}</Text>
                      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? c.brand : c.textMuted} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </>)}

          {step === "event" && (<>
            <Text style={s.q}>What&apos;s the occasion?</Text>
            <Text style={s.hint}>We&apos;ll tailor the booking to your event.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                  calendarBackground: c.surface2, backgroundColor: c.surface2, textSectionTitleColor: c.textMuted,
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.lg }}>
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
                <View style={{ flex: 1 }}><Text style={s.rowV}>{vendor.name}</Text><Text style={s.sub}>{vendor.city} • {vendor.category}</Text></View>
                {vendor.verified ? <Ionicons name="checkmark-circle" size={18} color={c.brand} /> : null}
              </View>
            )}
            {services.length > 0 && <Review icon="pricetag-outline" label="Package" value={selected?.title ?? "Custom quote"} to="package" />}
            <Review icon="sparkles-outline" label="Occasion" value={cap(eventType)} to="event" />
            <Review icon="calendar-outline" label="Date" value={prettyDate(date) || "Not chosen"} to="date" />
            <Review icon="people-outline" label="Guests" value={guests || "—"} to="guests" />
            <Review icon="document-text-outline" label="Notes" value={notes || "None"} to="notes" />
            <View style={[s.row, { borderBottomWidth: 0 }]}>
              <Ionicons name="wallet-outline" size={18} color={c.brand} />
              <Text style={[s.rowV, { flex: 1 }]}>Total</Text>
              <Text style={{ color: c.brand, fontSize: 20, fontWeight: "700" }}>{amount > 0 ? `₹${amount.toLocaleString("en-IN")}` : "Price on request"}</Text>
            </View>
          </>)}
          {err ? <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md }}><Ionicons name="alert-circle" size={16} color={c.error} /><Text style={{ color: c.error, flex: 1 }}>{err}</Text></View> : null}
        </Animated.View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {stepIdx > 0 && <GhostButton title="Back" onPress={() => go(-1)} style={{ flex: 1 }} />}
        <View style={{ flex: 2 }}>
          {step === "review"
            ? <GoldButton testID="submit-booking" title="Continue to Payment" onPress={submit} loading={loading} disabled={!date} />
            : <GoldButton testID="booking-next" title={step === "package" && !serviceId ? "Skip" : step === "notes" && !notes ? "Skip" : "Next"} onPress={() => go(1)} disabled={!valid(step)} />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
