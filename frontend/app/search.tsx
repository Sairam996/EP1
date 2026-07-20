import { useEffect, useState, useCallback } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Rating, Pill } from "@/src/components/UI";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

export default function Search() {
  const insets = useSafeAreaInsets();
  const { event_type } = useLocalSearchParams<{ event_type?: string }>();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.xl },
    searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
    input: { flex: 1, color: c.text, paddingVertical: 8 },
    card: { flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    img: { width: 110, height: 110 },
    cardName: { color: c.text, fontSize: 15, fontWeight: "600" },
    cardMeta: { color: c.textMuted, fontSize: 12 },
    cardPrice: { color: c.brand, fontSize: 14, fontWeight: "700", marginTop: 4 },
    empty: { color: c.textMuted, textAlign: "center", marginTop: 40 },
  }));

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
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput testID="search-input" value={q} onChangeText={setQ} placeholder="Search vendors..."
            placeholderTextColor={colors.textMuted} style={styles.input} autoFocus />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Pill label="All" active={!cat} onPress={() => setCat(null)} />
        {cats.map((c) => <Pill key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} testID={`s-cat-${c.id}`} />)}
      </ScrollView>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          ListEmptyComponent={<Text style={styles.empty}>No vendors found</Text>}
          renderItem={({ item }) => (
            <Pressable testID={`result-${item.id}`} onPress={() => router.push(`/vendor/${item.id}`)} style={styles.card}>
              <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
              <View style={{ flex: 1, padding: spacing.md, gap: 4 }}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.category} • {item.city}</Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 }}>
                  <Rating value={item.rating} size={12} />
                  <Text style={styles.cardMeta}>• {item.distance_km} km</Text>
                </View>
                <Text style={styles.cardPrice}>₹{item.starting_price.toLocaleString("en-IN")}+</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
