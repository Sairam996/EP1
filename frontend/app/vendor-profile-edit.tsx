import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton, Pill } from "@/src/components/UI";
import { PhotoPicker } from "@/src/components/PhotoPicker";
import { SocialLinkFields } from "@/src/components/SocialLinkFields";
import { fonts, colors, spacing, themedStyles } from "@/src/theme";

const CATS = ["venues", "catering", "photography", "decor", "music", "planning"];
const FACILITY_LIBRARY = ["AC Hall", "Valet", "Bridal Suite", "Stage", "Outdoor", "Garden",
  "Live Counters", "Vegetarian", "Non-Veg", "Buffet", "Tandoor", "Drone", "Same-Day Edits",
  "Pre-Wedding", "Candid", "Cinematography", "Albums", "Floral", "Lighting", "Mandap",
  "DJ", "Dhol", "Sound System", "End-to-End", "Destination"];
const EVENT_TYPES = [
  { id: "wedding", name: "Wedding" }, { id: "sangeet", name: "Sangeet" }, { id: "haldi", name: "Haldi" },
  { id: "mehendi", name: "Mehendi" }, { id: "reception", name: "Reception" }, { id: "engagement", name: "Engagement" },
  { id: "birthday", name: "Birthday" }, { id: "corporate", name: "Corporate" }, { id: "anniversary", name: "Anniversary" },
  { id: "baby_shower", name: "Baby Shower" },
];
const CITIES = ["Hyderabad", "Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"];
const PLACEHOLDER = "New vendor on Thara.";

export default function VendorProfileEdit() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<any>({});
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.get("/vendor/me").then(d => { setV(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const toggleFacility = (f: string) => {
    const cur = v.facilities || [];
    const next = cur.includes(f) ? cur.filter((x: string) => x !== f) : [...cur, f];
    set("facilities", next);
  };

  const toggleEvent = (e: string) => {
    const cur = v.event_types || [];
    set("event_types", cur.includes(e) ? cur.filter((x: string) => x !== e) : [...cur, e]);
  };

  const save = async () => {
    const desc = (v.description || "").trim();
    if (!v.name || v.name.trim().length < 2) { setMsg({ t: "Business name is required", ok: false }); return; }
    if (desc === PLACEHOLDER || desc.length < 30) { setMsg({ t: "Write at least 30 characters about your business", ok: false }); return; }
    const lat = v.lat === "" || v.lat == null ? undefined : parseFloat(String(v.lat));
    const lng = v.lng === "" || v.lng == null ? undefined : parseFloat(String(v.lng));
    if ((lat !== undefined && isNaN(lat)) || (lng !== undefined && isNaN(lng))) { setMsg({ t: "Latitude/longitude must be numbers", ok: false }); return; }
    setSaving(true);
    try {
      const upd: any = {
        name: v.name.trim(), category: v.category, city: v.city || "Hyderabad", cover: v.cover,
        gallery: v.gallery || [], description: desc, starting_price: parseInt(String(v.starting_price), 10) || 0,
        facilities: v.facilities || [], event_types: v.event_types || [], address: v.address || "",
        phone: v.phone || "", locality: v.locality || "",
        instagram_url: v.instagram_url || "", facebook_url: v.facebook_url || "", website_url: v.website_url || "",
      };
      if (lat !== undefined) upd.lat = lat;
      if (lng !== undefined) upd.lng = lng;
      const d = await api.patch("/vendor/me", upd);
      setV(d);
      setMsg({ t: "Saved ✓", ok: true }); setTimeout(() => setMsg(null), 2500);
    } catch (e: any) { setMsg({ t: e.message, ok: false }); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Edit Profile</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.lbl}>Business Name</Text>
        <TextInput value={v.name || ""} onChangeText={t => set("name", t)} style={styles.input} testID="vp-name" />

        <Text style={styles.lbl}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {CATS.map(c => <Pill key={c} label={c[0].toUpperCase() + c.slice(1)} active={v.category === c} onPress={() => set("category", c)} testID={`vp-cat-${c}`} />)}
        </ScrollView>

        <Text style={styles.lbl}>City</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {CITIES.map(c => <Pill key={c} label={c} active={(v.city || "Hyderabad") === c} onPress={() => set("city", c)} testID={`vp-city-${c}`} />)}
        </ScrollView>

        <Text style={styles.lbl}>Event Types You Serve</Text>
        <View style={styles.facWrap}>
          {EVENT_TYPES.map(e => {
            const on = (v.event_types || []).includes(e.id);
            return (
              <Pressable key={e.id} onPress={() => toggleEvent(e.id)} testID={`vp-et-${e.id}`}
                style={[styles.facChip, on && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
                <Text style={{ color: on ? colors.brand : colors.textSubtle, fontSize: 12 }}>{e.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.lbl}>Cover Photo</Text>
        <PhotoPicker single value={v.cover ? [v.cover] : []} onChange={(u) => set("cover", u[0] || "")} testID="vp-cover"
          hint="Your hero image on Thara — landscape, bright, shows your best work." />

        <Text style={styles.lbl}>Gallery ({(v.gallery || []).length}/20)</Text>
        <PhotoPicker value={v.gallery || []} onChange={(u) => set("gallery", u)} max={20} testID="vp-gal"
          hint="Add at least 3 photos. Use ◀ ▶ to reorder — the first photo shows first." />

        <Text style={styles.lbl}>About Your Business</Text>
        <TextInput value={v.description === PLACEHOLDER ? "" : (v.description || "")} placeholder="What makes you special? Experience, signature style, capacity…"
          placeholderTextColor={colors.textMuted} onChangeText={t => set("description", t)} multiline
          style={[styles.input, { height: 100, textAlignVertical: "top" }]} testID="vp-desc" />

        <Text style={styles.lbl}>Starting Price (INR)</Text>
        <TextInput value={String(v.starting_price || "")} onChangeText={t => set("starting_price", t)} keyboardType="number-pad" style={styles.input} testID="vp-price" />

        <Text style={styles.lbl}>Address</Text>
        <TextInput value={v.address || ""} onChangeText={t => set("address", t)} style={styles.input} testID="vp-addr" />

        <Text style={styles.lbl}>Locality / Area</Text>
        <TextInput value={v.locality || ""} onChangeText={t => set("locality", t)} placeholder="e.g. Jubilee Hills, Gachibowli"
          placeholderTextColor={colors.textMuted} style={styles.input} testID="vp-locality" />

        <Text style={styles.lbl}>Map Pin (optional)</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={v.lat != null ? String(v.lat) : ""} onChangeText={t => set("lat", t)} placeholder="Latitude 17.43"
            placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" style={[styles.input, { flex: 1 }]} testID="vp-lat" />
          <TextInput value={v.lng != null ? String(v.lng) : ""} onChangeText={t => set("lng", t)} placeholder="Longitude 78.41"
            placeholderTextColor={colors.textMuted} keyboardType="numbers-and-punctuation" style={[styles.input, { flex: 1 }]} testID="vp-lng" />
        </View>

        <Text style={styles.lbl}>Phone</Text>
        <TextInput value={v.phone || ""} onChangeText={t => set("phone", t)} keyboardType="phone-pad" style={styles.input} testID="vp-phone" />

        <SocialLinkFields
          value={{ instagram_url: v.instagram_url || "", facebook_url: v.facebook_url || "", website_url: v.website_url || "" }}
          onChange={(next) => setV((p: any) => ({ ...p, ...next }))}
        />

        <Text style={styles.lbl}>Facilities</Text>
        <View style={styles.facWrap}>
          {FACILITY_LIBRARY.map(f => (
            <Pressable key={f} onPress={() => toggleFacility(f)} testID={`fac-${f}`}
              style={[styles.facChip, (v.facilities || []).includes(f) && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
              <Text style={{ color: (v.facilities || []).includes(f) ? colors.brand : colors.textSubtle, fontSize: 12 }}>{f}</Text>
            </Pressable>
          ))}
        </View>

        {msg && <Text style={{ color: msg.ok ? colors.success : colors.error, marginTop: spacing.md }}>{msg.t}</Text>}
        <GoldButton testID="vp-save" title="Save Changes" onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = themedStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  title: { color: colors.text, fontSize: 18 + 4, fontFamily: fonts.displayBold },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 15 },
  facWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  facChip: { paddingHorizontal: 0, paddingVertical: 6, marginRight: 14, borderBottomWidth: 2, borderColor: "transparent" },
}));
