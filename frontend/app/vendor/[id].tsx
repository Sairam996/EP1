import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton, Rating } from "@/src/components/UI";
import { useUserLocation, openInMaps } from "@/src/hooks/use-location";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

const { width } = Dimensions.get("window");

export default function VendorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const { colors } = useTheme();
  const [v, setV] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [tab, setTab] = useState<"about" | "reviews" | "gallery">("about");
  const [favorited, setFavorited] = useState(false);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    loader: { flex: 1, backgroundColor: c.surface, justifyContent: "center" },
    heroScrim: { position: "absolute", top: 200, left: 0, right: 0, height: 200 },
    iconCircle: { position: "absolute", width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
    heroText: { position: "absolute", top: 240, left: 16, right: 16 },
    name: { color: "#F3F4F6", fontSize: 22, fontWeight: "600", letterSpacing: 0.2 },
    muted: { color: "rgba(243,244,246,0.8)", fontSize: 11 },
    verBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.brand, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, marginBottom: 6 },
    verT: { color: c.onBrand, fontSize: 10, fontWeight: "700" },
    tabRow: { flexDirection: "row", marginHorizontal: spacing.xl, marginTop: spacing.xl, borderBottomWidth: 1, borderColor: c.border },
    tab: { paddingVertical: 12, paddingHorizontal: 16 },
    tabActive: { borderBottomWidth: 2, borderColor: c.brand },
    tabT: { color: c.textMuted, fontWeight: "600" },
    tabActiveText: { color: c.brand },
    body: { color: c.textSubtle, fontSize: 14, lineHeight: 22, marginTop: spacing.lg },
    h3: { color: c.text, fontSize: 16, fontWeight: "600", marginBottom: 8 },
    facWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    fac: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface2, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
    facText: { color: c.textSubtle, fontSize: 13 },
    priceBig: { color: c.brand, fontSize: 26, fontWeight: "700" },
    locCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, backgroundColor: c.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
    locName: { color: c.text, fontWeight: "600" },
    locDist: { color: c.textMuted, fontSize: 12 },
    dirBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: c.brand },
    dirBtnGhost: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: c.brand, backgroundColor: "transparent" },
    dirText: { color: c.onBrand, fontWeight: "700", fontSize: 13 },
    dirGhostText: { color: c.brand, fontWeight: "600", fontSize: 11 },
    review: { padding: spacing.md, backgroundColor: c.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
    reviewer: { color: c.text, fontWeight: "600" },
    reviewText: { color: c.textSubtle, marginTop: 4 },
    simCard: { width: 168, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    simName: { color: c.text, fontWeight: "600" },
    cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: spacing.xl, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: 12 },
    ctaLabel: { color: c.textMuted, fontSize: 11 },
    ctaPrice: { color: c.brand, fontSize: 18, fontWeight: "700" },
    empty: { color: c.textMuted },
  }));

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
    try { const r = await api.post(`/favorites/${id}`); setFavorited(r.favorited); } catch { /* ignore */ }
  };

  if (!v) return <View style={styles.loader}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {v.gallery.map((src: string, i: number) => (
            <Image key={i} source={{ uri: src }} style={{ width, height: 340 }} contentFit="cover" />
          ))}
        </ScrollView>
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.95)"]} style={styles.heroScrim} />
        <Pressable onPress={() => router.back()} style={[styles.iconCircle, { top: insets.top + 8, left: 16 }]}>
          <Ionicons name="arrow-back" size={20} color="#F3F4F6" />
        </Pressable>
        <Pressable testID="fav-btn" onPress={toggleFav} style={[styles.iconCircle, { top: insets.top + 8, right: 16 }]}>
          <Ionicons name={favorited ? "heart" : "heart-outline"} size={20} color={favorited ? colors.error : "#F3F4F6"} />
        </Pressable>
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

        <View style={styles.tabRow}>
          {(["about", "reviews", "gallery"] as const).map((t) => (
            <Pressable key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabT, tab === t && styles.tabActiveText]}>{t[0].toUpperCase() + t.slice(1)}</Text>
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
                    <Text style={styles.facText}>{f}</Text>
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
                    <Text style={styles.locName} numberOfLines={2}>{v.address || v.city}</Text>
                    <Text style={styles.locDist}>{v.distance_km} km away</Text>
                  </View>
                  <View style={{ gap: 6, alignItems: "flex-end" }}>
                    <Pressable testID="in-app-nav" onPress={() => router.push(`/navigate/${v.id}` as any)} style={styles.dirBtn}>
                      <Ionicons name="navigate-circle" size={16} color={colors.onBrand} />
                      <Text style={styles.dirText}>Live Nav</Text>
                    </Pressable>
                    <Pressable testID="get-directions" onPress={() => openInMaps(v.lat, v.lng, v.name)} style={styles.dirBtnGhost}>
                      <Ionicons name="open-outline" size={13} color={colors.brand} />
                      <Text style={styles.dirGhostText}>Open Maps</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {tab === "reviews" && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.lg }}>
            {reviews.length === 0 ? <Text style={styles.empty}>No reviews yet.</Text> :
              reviews.map((r) => (
                <View key={r.id} style={styles.review}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.reviewer}>{r.user_name}</Text>
                    <Rating value={r.rating} />
                  </View>
                  <Text style={styles.reviewText}>{r.comment}</Text>
                </View>
              ))}
          </View>
        )}

        {tab === "gallery" && (
          <View style={{ paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.lg }}>
            {v.gallery.map((src: string, i: number) => (
              <Image key={i} source={{ uri: src }} style={{ width: (width - spacing.xl * 2 - 8) / 2, height: 140, borderRadius: radius.md }} contentFit="cover" />
            ))}
          </View>
        )}

        {similar.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[styles.h3, { paddingHorizontal: spacing.xl }]}>Similar vendors</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 12, paddingTop: 12 }}>
              {similar.map((s) => (
                <Pressable key={s.id} onPress={() => router.replace(`/vendor/${s.id}`)} style={styles.simCard}>
                  <Image source={{ uri: s.cover }} style={{ width: "100%", height: 100 }} contentFit="cover" />
                  <View style={{ padding: 10 }}>
                    <Text style={styles.simName} numberOfLines={1}>{s.name}</Text>
                    <Rating value={s.rating} size={12} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaLabel}>Starting</Text>
          <Text style={styles.ctaPrice}>₹{v.starting_price.toLocaleString("en-IN")}</Text>
        </View>
        <GoldButton testID="book-now-btn" title="Book Now" onPress={() => router.push(`/booking-form/${v.id}`)} style={{ minWidth: 160 }} />
      </View>
    </View>
  );
}
