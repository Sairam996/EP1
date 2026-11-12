import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, ImageTile, gutter } from "@/src/components/ui";
import { EmptyState } from "@/src/components/Polish";
import { formatFromPrice } from "@/src/utils/price";

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api.get("/favorites").then(setItems).catch(() => {}); }, []);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    header: { paddingHorizontal: gutter, paddingBottom: spacing.md },
    title: { color: c.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold, marginTop: spacing.md },
    empty: { color: c.textMuted, textAlign: "center", marginTop: 40 },
    name: { color: c.text, fontWeight: "600" },
    price: { color: c.brand, fontWeight: "700", marginTop: 4 },
  }));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back"><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Saved</Text>
        <EyebrowLabel muted style={{ marginTop: 4 }}>{items.length ? `${items.length} partner${items.length === 1 ? "" : "s"} you loved` : "Your shortlist"}</EyebrowLabel>
      </View>
      <FlatList initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} showsVerticalScrollIndicator={false}
        data={items} keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 60, gap: 3 }}
        ListEmptyComponent={<EmptyState icon="heart-outline" title="No favorites yet" message="Tap the heart on any partner to save it here." ctaTitle="Explore partners" ghost onCta={() => router.push("/search" as any)} />}
        renderItem={({ item }) => (
          <ImageTile onPress={() => router.push(`/vendor/${item.id}`)} uri={item.cover} height={240} radius={0} testID={`fav-${item.id}`}
            eyebrow={item.category} title={item.name}
            subtitle={[item.reviews_count > 0 || item.rating ? `★ ${Number(item.rating || 0).toFixed(1)}` : null, Number(item.starting_price) > 0 ? formatFromPrice(item.starting_price, item.price_unit) : null].filter(Boolean).join("   ·   ")}
            topRight={<Ionicons name="heart" size={20} color="#E2BE6E" />} />
        )}
      />
    </View>
  );
}
