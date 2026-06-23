import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

const MAX_PHOTOS = 15;

export default function VendorServices() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => setItems(await api.get("/vendor/services"));
  useEffect(() => { load(); }, []);

  const addPhoto = () => {
    if (!photoInput.trim() || photos.length >= MAX_PHOTOS) return;
    setPhotos([...photos, photoInput.trim()]);
    setPhotoInput("");
  };
  const rmPhoto = (i: number) => setPhotos(photos.filter((_, idx) => idx !== i));

  const add = async () => {
    if (!title || !price) { setMsg("Title and price required"); return; }
    setLoading(true); setMsg(null);
    try {
      await api.post("/vendor/services", { title, description: desc, price: parseInt(price, 10), photos });
      setTitle(""); setDesc(""); setPrice(""); setPhotos([]);
      setMsg(`Service added with ${photos.length} photo(s)`);
      load();
      setTimeout(() => setMsg(null), 2500);
    } catch (e: any) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  const del = async (id: string) => { await api.del(`/vendor/services/${id}`); load(); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>My Services</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.lbl}>Service / Package Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Premium Wedding Photography Package"
          placeholderTextColor={colors.textMuted} style={styles.input} testID="svc-title" />
        <Text style={styles.lbl}>Description / What's included</Text>
        <TextInput value={desc} onChangeText={setDesc}
          placeholder="2 photographers, 8 hrs, 300 edited photos, 2-min film, drone, same-day reels..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 90, textAlignVertical: "top" }]} multiline testID="svc-desc" />
        <Text style={styles.lbl}>Price (INR)</Text>
        <TextInput value={price} onChangeText={setPrice} placeholder="75000"
          placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="number-pad" testID="svc-price" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.lg, marginBottom: 6 }}>
          <Text style={styles.lbl}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((p, i) => (
            <View key={i} style={{ position: "relative" }}>
              <Image source={{ uri: p }} style={styles.thumb} contentFit="cover" />
              <Pressable onPress={() => rmPhoto(i)} style={styles.thumbRm} testID={`rm-photo-${i}`}>
                <Ionicons name="close" size={12} color={colors.text} />
              </Pressable>
            </View>
          ))}
          {photos.length === 0 && <Text style={{ color: colors.textMuted, fontSize: 12, paddingVertical: 8 }}>Add up to {MAX_PHOTOS} photos of your work</Text>}
        </ScrollView>
        {photos.length < MAX_PHOTOS && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TextInput value={photoInput} onChangeText={setPhotoInput} placeholder="Paste image URL"
              placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1, marginTop: 0 }]} testID="photo-input" />
            <Pressable onPress={addPhoto} style={styles.addBtn} testID="photo-add">
              <Ionicons name="add" size={20} color={colors.onBrand} />
            </Pressable>
          </View>
        )}
        {msg && <Text style={{ color: msg.includes("required") ? colors.error : colors.success, marginTop: 8 }}>{msg}</Text>}
        <GoldButton testID="svc-add" title="Add Service" onPress={add} loading={loading} style={{ marginTop: spacing.md }} />
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        <Text style={[styles.lbl, { marginTop: spacing.xl }]}>Existing Services ({items.length})</Text>
        {items.map(s => (
          <View key={s.id} style={styles.item}>
            {s.photos?.[0] ? <Image source={{ uri: s.photos[0] }} style={{ width: 60, height: 60, borderRadius: radius.sm }} contentFit="cover" /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "500" }} numberOfLines={1}>{s.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{s.description}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 13 }}>₹{s.price.toLocaleString("en-IN")}</Text>
                {s.photos?.length > 0 && (
                  <View style={styles.photoBadge}>
                    <Ionicons name="images" size={10} color={colors.brand} />
                    <Text style={{ color: colors.brand, fontSize: 10, fontWeight: "600" }}>{s.photos.length}</Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable testID={`del-${s.id}`} onPress={() => del(s.id)}>
              <Ionicons name="trash" size={18} color={colors.error} />
            </Pressable>
          </View>
        ))}
        {items.length === 0 && <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 8 }}>No services yet — add your first package above</Text>}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  form: { padding: spacing.xl, gap: 4 },
  lbl: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 14, marginTop: 4 },
  thumb: { width: 80, height: 80, borderRadius: radius.md },
  thumbRm: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  addBtn: { backgroundColor: colors.brand, width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  photoBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand },
});
