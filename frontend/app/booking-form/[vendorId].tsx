import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, resolveImg } from "@/src/api";
import { Image } from "expo-image";
import { GoldButton, Pill, Body } from "@/src/components/UI";
import { DateField } from "@/src/components/DateField";
import { colors, radius, spacing } from "@/src/theme";

const EVENT_TYPES = ["wedding", "sangeet", "haldi", "mehendi", "reception", "birthday", "corporate", "engagement"];

export default function BookingForm() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const insets = useSafeAreaInsets();
  const [vendor, setVendor] = useState<any>(null);
  const [eventType, setEventType] = useState("wedding");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("100");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { serviceId: initialService } = useLocalSearchParams<{ serviceId?: string }>();
  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(initialService || null);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  useEffect(() => {
    api.get(`/vendors/${vendorId}`, { auth: false }).then(setVendor).catch(console.warn);
    api.get(`/vendors/${vendorId}/services`, { auth: false }).then((s) => {
      setServices(s || []);
      if (!initialService && s?.length === 1) setServiceId(s[0].id);
    }).catch(() => {});
    api.get(`/vendors/${vendorId}/availability`, { auth: false })
      .then((a) => setUnavailable([...(a.blocked_dates || []), ...(a.full_dates || [])])).catch(() => {});
  }, [vendorId, initialService]);

  const selected = services.find((s) => s.id === serviceId);
  const amount = selected ? selected.price : (vendor?.starting_price || 50000);

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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Booking Details</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {vendor && (
          <View style={styles.vendorRow}>
            <Text style={styles.vendorName}>{vendor.name}</Text>
            <Text style={{ color: colors.brand, fontSize: 16, fontWeight: "600" }}>₹{Number(amount).toLocaleString("en-IN")}</Text>
          </View>
        )}
        {services.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: 0 }]}>Choose a Package</Text>
            <View style={{ gap: 8 }}>
              {services.map((s) => {
                const on = s.id === serviceId;
                return (
                  <Pressable key={s.id} testID={`pkg-${s.id}`} onPress={() => setServiceId(on ? null : s.id)}
                    style={[styles.pkg, on && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
                    {s.photos?.[0] ? <Image source={{ uri: resolveImg(s.photos[0]) }} style={styles.pkgImg} contentFit="cover" /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "500" }} numberOfLines={1}>{s.title}</Text>
                      {s.description ? <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>{s.description}</Text> : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: colors.brand, fontWeight: "700" }}>₹{Number(s.price).toLocaleString("en-IN")}</Text>
                      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={18} color={on ? colors.brand : colors.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <Text style={styles.label}>Event Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {EVENT_TYPES.map(et => (
            <Pill key={et} label={et[0].toUpperCase() + et.slice(1)} active={eventType === et} onPress={() => setEventType(et)} testID={`et-${et}`} />
          ))}
        </ScrollView>
        <DateField label="Event Date" value={date} onChange={setDate} testID="booking-date-field" disabledDates={unavailable} />
        <Text style={styles.label}>Number of Guests</Text>
        <TextInput testID="booking-guests" value={guests} onChangeText={setGuests} placeholder="100"
          placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="number-pad" />
        <Text style={styles.label}>Special Requirements</Text>
        <TextInput testID="booking-notes" value={notes} onChangeText={setNotes} placeholder="Any special requests..."
          placeholderTextColor={colors.textMuted} style={[styles.input, { height: 100, textAlignVertical: "top" }]} multiline />
        {err ? <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GoldButton testID="submit-booking" title={`Continue to Payment`} onPress={submit} loading={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  vendorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  vendorName: { color: colors.text, fontSize: 16, fontWeight: "500", flex: 1 },
  label: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  pkg: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  pkgImg: { width: 52, height: 52, borderRadius: radius.sm },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingTop: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
});
