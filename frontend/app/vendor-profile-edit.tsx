import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton, Pill } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

const CATS = ["venues", "catering", "photography", "decor", "music", "planning"];
const FACILITY_LIBRARY = ["AC Hall", "Valet", "Bridal Suite", "Stage", "Outdoor", "Garden",
  "Live Counters", "Vegetarian", "Non-Veg", "Buffet", "Tandoor", "Drone", "Same-Day Edits",
  "Pre-Wedding", "Candid", "Cinematography", "Albums", "Floral", "Lighting", "Mandap",
  "DJ", "Dhol", "Sound System", "End-to-End", "Destination"];

export default function VendorProfileEdit() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<any>({});
  const [coverInput, setCoverInput] = useState("");
  const [galleryInput, setGalleryInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get("/vendor/me").then(d => { setV(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));

  const toggleFacility = (f: string) => {
    const cur = v.facilities || [];
    const next = cur.includes(f) ? cur.filter((x: string) => x !== f) : [...cur, f];
    set("facilities", next);
  };

  const setCover = () => {
    if (!coverInput.trim()) return;
    set("cover", coverInput.trim());
    setCoverInput("");
  };
  const addGallery = () => {
    if (!galleryInput.trim()) return;
    set("gallery", [...(v.gallery || []), galleryInput.trim()]);
    setGalleryInput("");
  };
  const rmGallery = (i: number) => set("gallery", (v.gallery || []).filter((_: any, idx: number) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      const upd = {
        name: v.name, category: v.category, city: v.city, cover: v.cover,
        gallery: v.gallery, description: v.description, starting_price: parseInt(String(v.starting_price), 10) || 0,
        facilities: v.facilities, address: v.address, phone: v.phone,
      };
      await api.patch("/vendor/me", upd);
      setMsg("Saved!"); setTimeout(() => setMsg(null), 2500);
    } catch (e: any) { setMsg(e.message); }
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

        <Text style={styles.lbl}>Cover Image</Text>
        {v.cover ? (
          <View style={{ position: "relative", marginBottom: 8 }}>
            <Image source={{ uri: v.cover }} style={styles.cover} contentFit="cover" />
          </View>
        ) : <Text style={{ color: colors.textMuted, marginBottom: 8 }}>No cover yet</Text>}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={coverInput} onChangeText={setCoverInput} placeholder="Paste image URL"
            placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} testID="vp-cover-input" />
          <Pressable onPress={setCover} style={styles.addBtn} testID="vp-cover-set"><Ionicons name="checkmark" size={20} color={colors.onBrand} /></Pressable>
        </View>

        <Text style={styles.lbl}>Gallery</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(v.gallery || []).map((g: string, i: number) => (
            <View key={i} style={{ position: "relative" }}>
              <Image source={{ uri: g }} style={styles.thumb} contentFit="cover" />
              <Pressable onPress={() => rmGallery(i)} style={styles.thumbRm} testID={`vp-rm-${i}`}><Ionicons name="close" size={12} color={colors.text} /></Pressable>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput value={galleryInput} onChangeText={setGalleryInput} placeholder="Image URL to add"
            placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} testID="vp-gal-input" />
          <Pressable onPress={addGallery} style={styles.addBtn} testID="vp-gal-add"><Ionicons name="add" size={20} color={colors.onBrand} /></Pressable>
        </View>

        <Text style={styles.lbl}>Description</Text>
        <TextInput value={v.description || ""} onChangeText={t => set("description", t)} multiline
          style={[styles.input, { height: 100, textAlignVertical: "top" }]} testID="vp-desc" />

        <Text style={styles.lbl}>Starting Price (INR)</Text>
        <TextInput value={String(v.starting_price || "")} onChangeText={t => set("starting_price", t)} keyboardType="number-pad" style={styles.input} testID="vp-price" />

        <Text style={styles.lbl}>Address</Text>
        <TextInput value={v.address || ""} onChangeText={t => set("address", t)} style={styles.input} testID="vp-addr" />

        <Text style={styles.lbl}>Phone</Text>
        <TextInput value={v.phone || ""} onChangeText={t => set("phone", t)} keyboardType="phone-pad" style={styles.input} testID="vp-phone" />

        <Text style={styles.lbl}>Facilities</Text>
        <View style={styles.facWrap}>
          {FACILITY_LIBRARY.map(f => (
            <Pressable key={f} onPress={() => toggleFacility(f)} testID={`fac-${f}`}
              style={[styles.facChip, (v.facilities || []).includes(f) && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
              <Text style={{ color: (v.facilities || []).includes(f) ? colors.brand : colors.textSubtle, fontSize: 12 }}>{f}</Text>
            </Pressable>
          ))}
        </View>

        {msg && <Text style={{ color: colors.success, marginTop: spacing.md }}>{msg}</Text>}
        <GoldButton testID="vp-save" title="Save Changes" onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  cover: { width: "100%", height: 160, borderRadius: radius.md },
  thumb: { width: 80, height: 80, borderRadius: radius.md },
  thumbRm: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  addBtn: { backgroundColor: colors.brand, width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  facWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  facChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
});
