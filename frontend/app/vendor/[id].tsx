import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton, Rating } from "@/src/components/UI";
import { useUserLocation, openInMaps } from "@/src/hooks/use-location";
import { colors, radius, spacing } from "@/src/theme";

const { width } = Dimensions.get("window");

export default function VendorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const [v, setV] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [tab, setTab] = useState<"about" | "reviews" | "gallery">("about");
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
    (async () => {
      const [vd, r, s] = await Promise.all([
        api.get(`/vendors/${id}${q}`, { auth: false }),
        api.get(`/vendors/${id}/reviews`, { auth: false }),
        api.get(`/vendors/${id}/similar`, { auth: false }),
      ]);
      setV(vd); setReviews(r); setSimilar(s);
    })();
  }, [id, coords]);

  const toggleFav = async () => {
    try { const r = await api.post(`/favorites/${id}`); setFavorited(r.favorited); } catch {}
  };

  if (!v) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero gallery */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {v.gallery.map((src: string, i: number) => (
            <Image key={i} source={{ uri: src }} style={{ width, height: 340 }} contentFit="cover" />
          ))}
        </ScrollView>
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.95)"]} style={styles.heroScrim} />
        {/* Back & fav */}
        <Pressable onPress={() => router.back()} style={[styles.iconCircle, { top: insets.top + 8, left: 16 }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable testID="fav-btn" onPress={toggleFav} style={[styles.iconCircle, { top: insets.top + 8, right: 16 }]}>
          <Ionicons name={favorited ? "heart" : "heart-outline"} size={20} color={favorited ? colors.error : colors.text} />
        </Pressable>
        {/* Hero text */}
        <View style={styles.heroText}>
          {v.verified && <View style={styles.verBadge}><Ionicons name="checkmark-circle" size={12} color={colors.onBrand} /><Text style={styles.verT}>Verified</Text></View>}
          <Text style={styles.name}>{v.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Rating value={v.rating} size={14} />
            <Text style={styles.muted}>({v.reviews_count} reviews)</Text>
            <Text style={styles.muted}>•</Text>
            <Text style={styles.muted}>{v.distance_km} km</Text>
          </View>
          <Text style={[styles.muted, { marginTop: 4 }]}>{v.city} • {v.category}</Text>
        </View>
        {/* Tabs */}
        <View style={styles.tabRow}>
          {(["about", "reviews", "gallery"] as const).map(t => (
            <Pressable key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabT, tab === t && { color: colors.brand }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
        {tab === "about" && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
            <Text style={styles.body}>{v.description}</Text>
            <View>
              <Text style={styles.h3}>Facilities</Text>
              <View style={styles.facWrap}>
                {v.facilities.map((f: string) => (
                  <View key={f} style={styles.fac}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.brand} />
                    <Text style={{ color: colors.textSubtle, fontSize: 13 }}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.h3}>Starting at</Text>
              <Text style={styles.priceBig}>₹{v.starting_price.toLocaleString("en-IN")}</Text>
            </View>
            {v.lat != null && v.lng != null && (
              <View>
                <Text style={styles.h3}>Location</Text>
                <View style={styles.locCard}>
                  <Ionicons name="location" size={22} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "500" }} numberOfLines={2}>{v.address || v.city}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{v.distance_km} km away</Text>
                  </View>
                  <Pressable testID="get-directions" onPress={() => openInMaps(v.lat, v.lng, v.name)} style={styles.dirBtn}>
                    <Ionicons name="navigate" size={16} color={colors.onBrand} />
                    <Text style={{ color: colors.onBrand, fontWeight: "600", fontSize: 13 }}>Directions</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
        {tab === "reviews" && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
            {reviews.length === 0 ? <Text style={{ color: colors.textMuted }}>No reviews yet.</Text> :
              reviews.map(r => (
                <View key={r.id} style={styles.review}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "500" }}>{r.user_name}</Text>
                    <Rating value={r.rating} />
                  </View>
                  <Text style={{ color: colors.textSubtle, marginTop: 4 }}>{r.comment}</Text>
                </View>
              ))}
          </View>
        )}
        {tab === "gallery" && (
          <View style={{ paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {v.gallery.map((src: string, i: number) => (
              <Image key={i} source={{ uri: src }} style={{ width: (width - spacing.xl * 2 - 8) / 2, height: 140, borderRadius: radius.md }} contentFit="cover" />
            ))}
          </View>
        )}
        {/* Similar */}
        {similar.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[styles.h3, { paddingHorizontal: spacing.xl }]}>Similar vendors</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 12, paddingTop: 12 }}>
              {similar.map(s => (
                <Pressable key={s.id} onPress={() => router.replace(`/vendor/${s.id}`)} style={styles.simCard}>
                  <Image source={{ uri: s.cover }} style={{ width: "100%", height: 100 }} contentFit="cover" />
                  <View style={{ padding: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "500" }} numberOfLines={1}>{s.name}</Text>
                    <Rating value={s.rating} size={12} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.muted}>Starting</Text>
          <Text style={{ color: colors.brand, fontSize: 18, fontWeight: "600" }}>₹{v.starting_price.toLocaleString("en-IN")}</Text>
        </View>
        <GoldButton testID="book-now-btn" title="Book Now" onPress={() => router.push(`/booking-form/${v.id}`)} style={{ minWidth: 160 }} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  heroScrim: { position: "absolute", top: 200, left: 0, right: 0, height: 200 },
  iconCircle: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  heroText: { position: "absolute", top: 230, left: 16, right: 16 },
  name: { color: colors.text, fontSize: 22, fontWeight: "500" },
  muted: { color: colors.textSubtle, fontSize: 11 },
  verBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 6 },
  verT: { color: colors.onBrand, fontSize: 10, fontWeight: "700" },
  tabRow: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.xl, borderBottomWidth: 1, borderColor: colors.border },
  tab: { paddingVertical: 12, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 2, borderColor: colors.brand },
  tabT: { color: colors.textMuted, fontWeight: "500" },
  body: { color: colors.textSubtle, fontSize: 14, lineHeight: 22, marginTop: spacing.lg },
  h3: { color: colors.text, fontSize: 16, fontWeight: "500", marginBottom: 8 },
  facWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fac: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  priceBig: { color: colors.brand, fontSize: 24, fontWeight: "600" },
  locCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  dirBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  review: { padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  simCard: { width: 160, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: spacing.xl, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 },
});
