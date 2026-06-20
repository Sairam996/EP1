import { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Rating, Pill } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Search() {
  const insets = useSafeAreaInsets();
  const { event_type } = useLocalSearchParams<{ event_type?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      if (cat) params.append("category", cat);
      if (event_type) params.append("event_type", event_type as string);
      setItems(await api.get(`/vendors?${params.toString()}`, { auth: false }));
    } finally { setLoading(false); }
  }, [q, cat, event_type]);

  useEffect(() => { api.get("/categories", { auth: false }).then(setCats); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput testID="search-input" value={q} onChangeText={setQ} placeholder="Search vendors..."
            placeholderTextColor={colors.textMuted} style={{ flex: 1, color: colors.text, paddingVertical: 6 }} autoFocus />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Pill label="All" active={!cat} onPress={() => setCat(null)} />
        {cats.map(c => <Pill key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} testID={`s-cat-${c.id}`} />)}
      </ScrollView>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 40 }}>No vendors found</Text>}
          renderItem={({ item }) => (
            <Pressable testID={`result-${item.id}`} onPress={() => router.push(`/vendor/${item.id}`)} style={styles.card}>
              <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.category} • {item.city}</Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 }}>
                  <Rating value={item.rating} size={12} />
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>• {item.distance_km} km</Text>
                </View>
                <Text style={{ color: colors.brand, fontSize: 14, fontWeight: "600", marginTop: 4 }}>₹{item.starting_price.toLocaleString("en-IN")}+</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.xl },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface2, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  card: { flexDirection: "row", backgroundColor: colors.surface2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  img: { width: 110, height: 110 },
});
