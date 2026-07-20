import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/api";
import { radius, spacing, useThemedStyles } from "@/src/theme";
import { Rating } from "@/src/components/UI";
import { TharaLogo } from "@/src/components/TharaLogo";
import { AnimatedChip, AnimatedEventTile } from "@/src/components/AnimatedChips";

const { width } = Dimensions.get("window");

const HERO_IMAGES = [
  "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
  "https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg",
  "https://images.pexels.com/photos/35508916/pexels-photo-35508916.jpeg",
];

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useTheme();
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

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    cityPick: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surface2, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
    cityText: { color: c.text, fontWeight: "600" },
    iconBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
    cityDrop: { marginTop: spacing.sm, paddingVertical: 4 },
    cityChip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    greet: { color: c.text, fontSize: 22, fontWeight: "600", letterSpacing: 0.2 },
    greetSub: { color: c.textMuted, fontSize: 13, marginTop: 4 },
    hero: { height: 168, borderRadius: radius.lg, overflow: "hidden" },
    heroImg: { width: "100%", height: "100%" },
    heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
    heroText: { position: "absolute", left: 16, bottom: 16, right: 16 },
    heroLabel: { color: c.brand, fontSize: 11, letterSpacing: 2, fontWeight: "600" },
    heroTitle: { color: "#F3F4F6", fontSize: 18, fontWeight: "500", marginTop: 2 },
    section: { color: c.text, fontSize: 15, fontWeight: "600", marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xl },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: spacing.xl },
    chipRow: { paddingHorizontal: spacing.xl, gap: 8 },
    vCard: { width: 190, height: 230, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    vImg: { width: "100%", height: "100%", position: "absolute" },
    vScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" },
    vMeta: { position: "absolute", left: 12, bottom: 12, right: 12 },
    vName: { color: "#F3F4F6", fontSize: 14, fontWeight: "600", marginBottom: 2 },
    vRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    vDot: { color: "rgba(243,244,246,0.7)" },
    vMuted: { color: "rgba(243,244,246,0.85)", fontSize: 11 },
    vPrice: { color: c.brand, fontSize: 13, fontWeight: "700", marginTop: 3 },
    verifiedBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.brand, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    verifiedText: { color: c.onBrand, fontSize: 9, fontWeight: "700" },
    combo: { height: 168, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    comboImg: { width: "100%", height: "100%", position: "absolute" },
    comboScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "85%" },
    comboBox: { position: "absolute", left: 16, right: 16, bottom: 16 },
    comboTitle: { color: "#F3F4F6", fontSize: 18, fontWeight: "600" },
    comboDesc: { color: "rgba(243,244,246,0.85)", fontSize: 11, marginTop: 3 },
    comboPrice: { color: c.brand, fontSize: 17, fontWeight: "700" },
    comboOrig: { color: "rgba(243,244,246,0.6)", fontSize: 12, textDecorationLine: "line-through" },
    comboSave: { color: "#22C55E", fontSize: 11, fontWeight: "700" },
    fab: { position: "absolute", right: 18, width: 52, height: 52, borderRadius: 26, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", shadowColor: c.brand, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6 },
    seeAll: { color: c.brand, fontSize: 13, fontWeight: "600" },
    empty: { color: c.textMuted, padding: spacing.md },
  }));

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
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        {/* Top bar with brand + city + search */}
        <View style={styles.topBar}>
          <Pressable testID="city-selector" onPress={() => setCityOpen((o) => !o)} style={styles.cityPick}>
            <Ionicons name="location" size={16} color={colors.brand} />
            <Text style={styles.cityText}>{city}</Text>
            <Ionicons name={cityOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
          </Pressable>
          <TharaLogo variant="wordmark" height={26} />
          <Pressable testID="search-btn" onPress={() => router.push("/search")} style={styles.iconBtn}>
            <Ionicons name="search" size={20} color={colors.text} />
          </Pressable>
        </View>

        {cityOpen && (
          <View style={styles.cityDrop} testID="city-dropdown">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}>
              {cities.map((cc) => (
                <Pressable key={cc} testID={`city-opt-${cc}`} onPress={() => { setCity(cc); setCityOpen(false); }}
                  style={[styles.cityChip, cc === city && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
                  <Text style={{ color: cc === city ? colors.brand : colors.textSubtle }}>{cc}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Hero greeting */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Text style={styles.greet}>Namaste {user?.name?.split(" ")[0] || ""}</Text>
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

        <Text style={styles.section}>Event Types</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {eventTypes.map((et) => (
            <AnimatedEventTile key={et.id} testID={`event-${et.id}`} label={et.name} icon={et.icon}
              onPress={() => router.push(`/search?event_type=${et.id}`)} />
          ))}
        </ScrollView>

        <Text style={styles.section}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <AnimatedChip testID="cat-all" label="All" active={!category} onPress={() => setCategory(null)} />
          {categories.map((cat) => (
            <AnimatedChip key={cat.id} testID={`cat-${cat.id}`} label={cat.name} icon={cat.icon}
              active={category === cat.id} onPress={() => setCategory(cat.id)} />
          ))}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Trending in {city}</Text>
          <Pressable onPress={() => router.push("/search")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 14 }}>
            {vendors.length === 0 && <Text style={styles.empty}>No vendors yet in {city}.</Text>}
            {vendors.map((v) => (
              <Pressable key={v.id} testID={`vendor-card-${v.id}`} onPress={() => router.push(`/vendor/${v.id}`)} style={styles.vCard}>
                <Image source={{ uri: v.cover }} style={styles.vImg} contentFit="cover" />
                {v.verified && <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={12} color={colors.onBrand} /><Text style={styles.verifiedText}>Verified</Text></View>}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.88)"]} style={styles.vScrim} />
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

        <Text style={styles.section}>Combo Packages</Text>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          {combos.map((cb) => (
            <Pressable key={cb.id} testID={`combo-${cb.id}`} style={styles.combo}>
              <Image source={{ uri: cb.cover }} style={styles.comboImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.92)"]} style={styles.comboScrim} />
              <View style={styles.comboBox}>
                <Text style={styles.comboTitle}>{cb.name}</Text>
                <Text style={styles.comboDesc} numberOfLines={2}>{cb.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  <Text style={styles.comboPrice}>₹{cb.price.toLocaleString("en-IN")}</Text>
                  <Text style={styles.comboOrig}>₹{cb.original_price.toLocaleString("en-IN")}</Text>
                  <Text style={styles.comboSave}>Save ₹{cb.savings.toLocaleString("en-IN")}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable testID="ai-fab" onPress={() => router.push("/ai-chat")} style={[styles.fab, { bottom: 80 }]}>
        <Ionicons name="sparkles" size={22} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}
