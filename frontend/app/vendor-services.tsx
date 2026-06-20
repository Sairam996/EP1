import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function VendorServices() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => setItems(await api.get("/vendor/services"));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title || !price) return;
    setLoading(true);
    try { await api.post("/vendor/services", { title, description: desc, price: parseInt(price, 10), photos: [] });
      setTitle(""); setDesc(""); setPrice(""); load();
    } finally { setLoading(false); }
  };
  const del = async (id: string) => { await api.del(`/vendor/services/${id}`); load(); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>My Services</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.lbl}>Service Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Premium Wedding Photography" placeholderTextColor={colors.textMuted} style={styles.input} testID="svc-title" />
        <Text style={styles.lbl}>Description</Text>
        <TextInput value={desc} onChangeText={setDesc} placeholder="What's included..." placeholderTextColor={colors.textMuted} style={[styles.input, { height: 80, textAlignVertical: "top" }]} multiline testID="svc-desc" />
        <Text style={styles.lbl}>Price (INR)</Text>
        <TextInput value={price} onChangeText={setPrice} placeholder="75000" placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="number-pad" testID="svc-price" />
        <GoldButton testID="svc-add" title="Add Service" onPress={add} loading={loading} style={{ marginTop: spacing.md }} />
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        {items.map(s => (
          <View key={s.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "500" }}>{s.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{s.description}</Text>
              <Text style={{ color: colors.brand, fontWeight: "600", marginTop: 4 }}>₹{s.price.toLocaleString("en-IN")}</Text>
            </View>
            <Pressable testID={`del-${s.id}`} onPress={() => del(s.id)}><Ionicons name="trash" size={18} color={colors.error} /></Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  form: { padding: spacing.xl, gap: 4 },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  item: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
