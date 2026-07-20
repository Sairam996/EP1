import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Rating } from "@/src/components/UI";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get("/favorites").then(setItems).catch(() => {}); }, []);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: c.border },
    title: { color: c.text, fontSize: 20, fontWeight: "600" },
    card: { flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    img: { width: 100, height: 100 },
    empty: { color: c.textMuted, textAlign: "center", marginTop: 40 },
    name: { color: c.text, fontWeight: "600" },
    price: { color: c.brand, fontWeight: "700", marginTop: 4 },
  }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Favorites</Text>
      </View>
      <FlatList
        data={items} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={<Text style={styles.empty}>No favorites yet — tap the heart on any vendor</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/vendor/${item.id}`)} style={styles.card}>
            <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1, padding: spacing.md }}>
              <Text style={styles.name}>{item.name}</Text>
              <Rating value={item.rating} size={12} />
              <Text style={styles.price}>₹{item.starting_price.toLocaleString("en-IN")}+</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
