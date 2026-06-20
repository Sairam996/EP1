import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { Rating } from "@/src/components/UI";

const { width } = Dimensions.get("window");

const HERO_IMAGES = [
  "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
  "https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg",
  "https://images.pexels.com/photos/35508916/pexels-photo-35508916.jpeg",
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [city, setCity] = useState(user?.city || "Hyderabad");
  const [cities, setCities] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cityOpen, setCityOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, e, ci, v, cb] = await Promise.all([
        api.get("/categories", { auth: false }),
        api.get("/event-types", { auth: false }),
        api.get("/cities", { auth: false }),
        api.get(`/vendors?city=${city}${category ? `&category=${category}` : ""}&trending=true&limit=20`, { auth: false }),
        api.get("/combos", { auth: false }),
      ]);
      setCategories(c); setEventTypes(e); setCities(ci); setVendors(v); setCombos(cb);
    } catch (err) { console.warn(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [city, category]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable testID="city-selector" onPress={() => setCityOpen(o => !o)} style={styles.cityPick}>
            <Ionicons name="location" size={16} color={colors.brand} />
            <Text style={styles.cityText}>{city}</Text>
            <Ionicons name={cityOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
          </Pressable>
          <Pressable testID="search-btn" onPress={() => router.push("/search")} style={styles.iconBtn}>
            <Ionicons name="search" size={20} color={colors.text} />
          </Pressable>
        </View>
        {cityOpen && (
          <View style={styles.cityDrop} testID="city-dropdown">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}>
              {cities.map(c => (
                <Pressable key={c} testID={`city-opt-${c}`} onPress={() => { setCity(c); setCityOpen(false); }}
                  style={[styles.cityChip, c === city && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
                  <Text style={{ color: c === city ? colors.brand : colors.textSubtle }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        {/* Hero greeting */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
          <Text style={styles.greet}>Hello {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.greetSub}>Plan your perfect celebration ✨</Text>
        </View>
        {/* Hero carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.lg }}>
          {HERO_IMAGES.map((src, i) => (
            <View key={i} style={[styles.hero, { width: width - spacing.xl * 2, marginLeft: i === 0 ? spacing.xl : spacing.md }]}>
              <Image source={{ uri: src }} style={styles.heroImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.heroScrim} />
              <View style={styles.heroText}>
                <Text style={styles.heroLabel}>FEATURED</Text>
                <Text style={styles.heroTitle}>Luxury Weddings, Curated.</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        {/* Event types */}
        <Text style={styles.section}>Event Types</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {eventTypes.map(et => (
            <Pressable key={et.id} testID={`event-${et.id}`}
              onPress={() => router.push(`/search?event_type=${et.id}`)}
              style={styles.eventTile}>
              <View style={styles.eventIconWrap}>
                <Ionicons name={et.icon} size={22} color={colors.brand} />
              </View>
              <Text style={styles.eventLbl}>{et.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {/* Categories */}
        <Text style={styles.section}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable testID="cat-all" onPress={() => setCategory(null)}
            style={[styles.catChip, !category && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
            <Text style={{ color: !category ? colors.brand : colors.textSubtle, fontWeight: "500" }}>All</Text>
          </Pressable>
          {categories.map(c => (
            <Pressable key={c.id} testID={`cat-${c.id}`} onPress={() => setCategory(c.id)}
              style={[styles.catChip, category === c.id && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
              <Ionicons name={c.icon} size={14} color={category === c.id ? colors.brand : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={{ color: category === c.id ? colors.brand : colors.textSubtle, fontWeight: "500" }}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {/* Trending vendors */}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>Trending in {city}</Text>
          <Pressable onPress={() => router.push("/search")}>
            <Text style={{ color: colors.brand, fontSize: 13 }}>See all</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 14 }}>
            {vendors.length === 0 && <Text style={{ color: colors.textMuted, padding: spacing.md }}>No vendors yet in {city}.</Text>}
            {vendors.map(v => (
              <Pressable key={v.id} testID={`vendor-card-${v.id}`} onPress={() => router.push(`/vendor/${v.id}`)} style={styles.vCard}>
                <Image source={{ uri: v.cover }} style={styles.vImg} contentFit="cover" />
                {v.verified && <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={12} color={colors.onBrand} /><Text style={styles.verifiedText}>Verified</Text></View>}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.vScrim} />
                <View style={styles.vMeta}>
                  <Text style={styles.vName} numberOfLines={1}>{v.name}</Text>
                  <View style={styles.vRow}>
                    <Rating value={v.rating} />
                    <Text style={styles.vDot}>•</Text>
                    <Text style={styles.vMuted}>{v.distance_km} km</Text>
                  </View>
                  <Text style={styles.vPrice}>₹{v.starting_price.toLocaleString("en-IN")}+</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {/* Combos */}
        <Text style={styles.section}>Combo Packages</Text>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          {combos.map(c => (
            <Pressable key={c.id} testID={`combo-${c.id}`} style={styles.combo}>
              <Image source={{ uri: c.cover }} style={styles.comboImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.92)"]} style={styles.comboScrim} />
              <View style={styles.comboBox}>
                <Text style={styles.comboTitle}>{c.name}</Text>
                <Text style={styles.comboDesc} numberOfLines={2}>{c.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  <Text style={styles.comboPrice}>₹{c.price.toLocaleString("en-IN")}</Text>
                  <Text style={styles.comboOrig}>₹{c.original_price.toLocaleString("en-IN")}</Text>
                  <Text style={styles.comboSave}>Save ₹{c.savings.toLocaleString("en-IN")}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {/* Floating AI button */}
      <Pressable testID="ai-fab" onPress={() => router.push("/ai-chat")} style={[styles.fab, { bottom: 80 }]}>
        <Ionicons name="sparkles" size={22} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  cityPick: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  cityText: { color: colors.text, fontWeight: "500" },
  iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  cityDrop: { marginTop: spacing.sm, paddingVertical: 4 },
  cityChip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  greet: { color: colors.text, fontSize: 24, fontWeight: "500" },
  greetSub: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  hero: { height: 200, borderRadius: radius.lg, overflow: "hidden" },
  heroImg: { width: "100%", height: "100%" },
  heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  heroText: { position: "absolute", left: 16, bottom: 16, right: 16 },
  heroLabel: { color: colors.brand, fontSize: 11, letterSpacing: 2, fontWeight: "600" },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: "500", marginTop: 2 },
  section: { color: colors.text, fontSize: 18, fontWeight: "500", marginTop: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.xl },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: spacing.xl },
  chipRow: { paddingHorizontal: spacing.xl, gap: 10 },
  eventTile: { alignItems: "center", width: 76 },
  eventIconWrap: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  eventLbl: { color: colors.textSubtle, fontSize: 11, marginTop: 6, textAlign: "center" },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, flexShrink: 0 },
  vCard: { width: 220, height: 270, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface2 },
  vImg: { width: "100%", height: "100%", position: "absolute" },
  vScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" },
  vMeta: { position: "absolute", left: 14, bottom: 14, right: 14 },
  vName: { color: colors.text, fontSize: 16, fontWeight: "500", marginBottom: 4 },
  vRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  vDot: { color: colors.textMuted },
  vMuted: { color: colors.textMuted, fontSize: 12 },
  vPrice: { color: colors.brand, fontSize: 14, fontWeight: "600", marginTop: 4 },
  verifiedBadge: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brand, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  verifiedText: { color: colors.onBrand, fontSize: 10, fontWeight: "700" },
  combo: { height: 200, borderRadius: radius.lg, overflow: "hidden" },
  comboImg: { width: "100%", height: "100%", position: "absolute" },
  comboScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "85%" },
  comboBox: { position: "absolute", left: 16, right: 16, bottom: 16 },
  comboTitle: { color: colors.text, fontSize: 22, fontWeight: "500" },
  comboDesc: { color: colors.textSubtle, fontSize: 12, marginTop: 4 },
  comboPrice: { color: colors.brand, fontSize: 20, fontWeight: "600" },
  comboOrig: { color: colors.textMuted, fontSize: 13, textDecorationLine: "line-through" },
  comboSave: { color: colors.success, fontSize: 12, fontWeight: "600" },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", shadowColor: colors.brand, shadowOpacity: 0.6, shadowRadius: 16, elevation: 8 },
});
