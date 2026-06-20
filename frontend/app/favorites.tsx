import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { Rating } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get("/favorites").then(setItems); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Favorites</Text>
      </View>
      <FlatList
        data={items} keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 40 }}>No favorites yet — tap the heart on any vendor</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/vendor/${item.id}`)} style={styles.card}>
            <Image source={{ uri: item.cover }} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1, padding: spacing.md }}>
              <Text style={{ color: colors.text, fontWeight: "500" }}>{item.name}</Text>
              <Rating value={item.rating} size={12} />
              <Text style={{ color: colors.brand, fontWeight: "600", marginTop: 4 }}>₹{item.starting_price.toLocaleString("en-IN")}+</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  card: { flexDirection: "row", backgroundColor: colors.surface2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  img: { width: 100, height: 100 },
});
