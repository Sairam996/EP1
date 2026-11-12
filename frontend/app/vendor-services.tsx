import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert, Platform } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, resolveImg } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { PhotoPicker } from "@/src/components/PhotoPicker";
import { fonts, colors, radius, spacing, themedStyles } from "@/src/theme";
import { EmptyState } from "@/src/components/Polish";
import { SocialLinkFields } from "@/src/components/SocialLinkFields";
import type { SocialFields } from "@/src/utils/socialLinks";

const MAX_PHOTOS = 15;

// Quick-start package templates per category — vendors tap one to prefill the form.
const TEMPLATES: Record<string, { title: string; description: string; price: number }[]> = {
  venues: [
    { title: "Banquet Hall — Full Day", description: "AC hall up to 300 guests, stage, bridal room, valet parking, 12 hrs.", price: 150000 },
    { title: "Lawn Evening Package", description: "Open lawn up to 500 guests, lighting, power backup, 6 hrs.", price: 120000 },
  ],
  catering: [
    { title: "Classic Veg Thali (per plate)", description: "2 starters, 4 mains, 2 desserts, live chaat counter.", price: 650 },
    { title: "Hyderabadi Royal Buffet (per plate)", description: "Dum biryani, haleem, kebabs, double ka meetha, 4 live counters.", price: 1100 },
  ],
  photography: [
    { title: "Wedding Day Candid", description: "2 photographers, 8 hrs, 400 edited photos, online gallery.", price: 60000 },
    { title: "Photo + Film Premium", description: "Candid + traditional, cinematic 5-min film, drone, album.", price: 140000 },
  ],
  decor: [
    { title: "Mandap & Stage Florals", description: "Fresh flower mandap, stage backdrop, entrance arch.", price: 75000 },
    { title: "Sangeet Night Lighting", description: "Fairy lights, LED dance floor, themed props.", price: 45000 },
  ],
  music: [
    { title: "DJ Night (5 hrs)", description: "Pro DJ, 2kW sound, basic lights, MC for games.", price: 30000 },
    { title: "DJ + Live Dhol", description: "DJ set plus 2 dhol players for baraat & sangeet.", price: 48000 },
  ],
  planning: [
    { title: "Day-of Coordination", description: "Coordinator + 2 assistants, team coordination on the day.", price: 40000 },
    { title: "Full Wedding Planning", description: "End-to-end planning, budgets, sourcing, 3 events.", price: 250000 },
  ],
};

export default function VendorServices() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [category, setCategory] = useState<string>("venues");
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [links, setLinks] = useState<SocialFields>({ instagram_url: "", facebook_url: "", website_url: "" });
  const [vendorLinks, setVendorLinks] = useState<SocialFields>({ instagram_url: "", facebook_url: "", website_url: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);

  const fromVendor = (v: any): SocialFields => ({
    instagram_url: v?.instagram_url || "", facebook_url: v?.facebook_url || "", website_url: v?.website_url || "",
  });
  const load = async () => setItems(await api.get("/vendor/services"));
  useEffect(() => {
    load();
    api.get("/vendor/me").then((v) => {
      if (v?.category) setCategory(v.category);
      const vl = fromVendor(v);
      setVendorLinks(vl);
      setLinks((cur) => (cur.instagram_url || cur.facebook_url || cur.website_url) ? cur : vl);
    }).catch(() => {});
  }, []);

  const reset = () => { setEditId(null); setTitle(""); setDesc(""); setPrice(""); setPhotos([]); setLinks(vendorLinks); };
  const flash = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 2800); };

  const startEdit = (s: any) => {
    setEditId(s.id); setTitle(s.title); setDesc(s.description || ""); setPrice(String(s.price)); setPhotos(s.photos || []);
    setLinks({
      instagram_url: s.instagram_url || vendorLinks.instagram_url || "",
      facebook_url: s.facebook_url || vendorLinks.facebook_url || "",
      website_url: s.website_url || vendorLinks.website_url || "",
    });
  };

  const save = async () => {
    const p = parseInt(price, 10);
    if (title.trim().length < 2 || !p || p <= 0) { flash("Title and a valid price are required", false); return; }
    setLoading(true);
    try {
      const body = {
        title: title.trim(), description: desc.trim(), price: p, photos,
        instagram_url: links.instagram_url || "", facebook_url: links.facebook_url || "", website_url: links.website_url || "",
      };
      if (editId) await api.patch(`/vendor/services/${editId}`, body);
      else await api.post("/vendor/services", body);
      flash(editId ? "Package updated ✓" : `Package added with ${photos.length} photo(s) ✓`);
      reset(); load();
    } catch (e: any) { flash(e.message, false); }
    finally { setLoading(false); }
  };

  const del = (id: string) => {
    const go = async () => { await api.del(`/vendor/services/${id}`); if (editId === id) reset(); load(); };
    if (Platform.OS === "web") { go(); return; }
    Alert.alert("Delete package?", "Customers will no longer see it.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: go }]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Packages & Services</Text>
      </View>

      {!editId && (TEMPLATES[category] || []).length > 0 && (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <Text style={styles.lbl}>Quick start templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
            {TEMPLATES[category].map((t) => (
              <Pressable key={t.title} style={styles.tpl} onPress={() => { setTitle(t.title); setDesc(t.description); setPrice(String(t.price)); }} testID={`tpl-${t.title}`}>
                <Ionicons name="sparkles" size={14} color={colors.brand} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "500" }} numberOfLines={1}>{t.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.form}>
        {editId && (
          <View style={styles.editBanner}>
            <Ionicons name="create" size={16} color={colors.brand} />
            <Text style={{ color: colors.brand, flex: 1, fontWeight: "600" }}>Editing package</Text>
            <Pressable onPress={reset}><Text style={{ color: colors.textMuted }}>Cancel</Text></Pressable>
          </View>
        )}
        <Text style={styles.lbl}>Package Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Premium Wedding Photography Package"
          placeholderTextColor={colors.textMuted} style={styles.input} testID="svc-title" />
        <Text style={styles.lbl}>What{"'"}s included</Text>
        <TextInput value={desc} onChangeText={setDesc}
          placeholder="2 photographers, 8 hrs, 300 edited photos, 2-min film, drone, same-day reels..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 90, textAlignVertical: "top" }]} multiline testID="svc-desc" />
        <Text style={styles.lbl}>Price (INR)</Text>
        <TextInput value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ""))} placeholder="75000"
          placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="number-pad" testID="svc-price" />
        <Text style={[styles.lbl, { marginBottom: 8 }]}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
        <PhotoPicker value={photos} onChange={setPhotos} max={MAX_PHOTOS} testID="svc-photos" hint="Show real work from this package — customers book what they can see." />
        <SocialLinkFields value={links} onChange={setLinks} hint="Share Instagram, Facebook or your website so customers can see your work." />
        {msg && <Text style={{ color: msg.ok ? colors.success : colors.error, marginTop: 8 }}>{msg.t}</Text>}
        <GoldButton testID="svc-add" title={editId ? "Save Package" : "Add Package"} onPress={save} loading={loading} style={{ marginTop: spacing.md }} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        <Text style={[styles.lbl, { marginTop: spacing.xl }]}>Your Packages ({items.length})</Text>
        {items.map(s => (
          <Pressable key={s.id} style={[styles.item, editId === s.id && { borderColor: colors.brand }]} onPress={() => startEdit(s)} testID={`svc-${s.id}`}>
            {s.photos?.[0] ? <Image source={{ uri: resolveImg(s.photos[0]) }} style={{ width: 60, height: 60, borderRadius: radius.sm }} contentFit="cover" />
              : <View style={[styles.noPic]}><Ionicons name="image-outline" size={20} color={colors.textMuted} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "500" }} numberOfLines={1}>{s.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{s.description}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 13 }}>₹{Number(s.price).toLocaleString("en-IN")}</Text>
                {s.photos?.length > 0 && (
                  <View style={styles.photoBadge}>
                    <Ionicons name="images" size={10} color={colors.brand} />
                    <Text style={{ color: colors.brand, fontSize: 10, fontWeight: "600" }}>{s.photos.length}</Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable testID={`edit-${s.id}`} onPress={() => startEdit(s)} hitSlop={8}><Ionicons name="create-outline" size={18} color={colors.brand} /></Pressable>
            <Pressable testID={`del-${s.id}`} onPress={() => del(s.id)} hitSlop={8}><Ionicons name="trash" size={18} color={colors.error} /></Pressable>
          </Pressable>
        ))}
        {items.length === 0 && <EmptyState compact icon="pricetags-outline" title="No packages yet" message="Add at least one to go live on Thara." />}
      </View>
    </ScrollView>
  );
}
const styles = themedStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  title: { color: colors.text, fontSize: 18 + 4, fontFamily: fonts.displayBold },
  form: { padding: spacing.xl, gap: 4 },
  lbl: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, marginTop: 4 },
  tpl: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 14, paddingVertical: 8, maxWidth: 240 },
  editBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: spacing.sm },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  noPic: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  photoBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 2 },
}));
