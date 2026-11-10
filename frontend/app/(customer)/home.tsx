import { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Dimensions, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api, resolveImg } from "@/src/api";
import { fonts, radius, spacing, useThemedStyles } from "@/src/theme";
import { SAMPLE_VENDOR } from "@/src/sampleVendor";
import { Rating } from "@/src/components/UI";
import { TharaLogo } from "@/src/components/TharaLogo";
import { AnimatedChip, AnimatedEventTile } from "@/src/components/AnimatedChips";
import { EmptyState } from "@/src/components/Polish";
import { RotatingHint } from "@/src/components/RotatingHint";

const { width } = Dimensions.get("window");
const HERO_W = width - spacing.xl * 2;
const HERO_GAP = spacing.md;
const inr = (n: unknown) => { const v = Number(n); return Number.isFinite(v) ? v.toLocaleString("en-IN") : null; };

// Combos have no detail route: open vendor if linked, else search filtered by the event type the combo is for.
const openCombo = (cb: any) => {
  if (cb?.vendor_id) return router.push(`/vendor/${cb.vendor_id}`);
  const text = `${cb?.name || ""} ${cb?.description || ""}`.toLowerCase();
  const KEYS: [string, string][] = [["wedding", "wedding"], ["sangeet", "sangeet"], ["haldi", "haldi"], ["mehendi", "mehendi"], ["mehndi", "mehendi"],
    ["reception", "reception"], ["birthday", "birthday"], ["corporate", "corporate"], ["anniversary", "anniversary"], ["engagement", "engagement"], ["baby shower", "baby_shower"]];
  const hit = KEYS.find(([k]) => text.includes(k));
  router.push(hit ? `/search?event_type=${hit[1]}` : "/search");
};
const HERO_COPY = [
  { label: "FEATURED", title: "Luxury Weddings, Curated." },
  { label: "SANGEET & MEHENDI", title: "Nights Full of Colour & Music." },
  { label: "NOW IN HYDERABAD", title: "Celebrations, Made Effortless." },
  { label: "BIRTHDAYS & CORPORATE", title: "Every Milestone, Beautifully Hosted." },
];
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastLoad = useRef(0);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    topSide: { flex: 1, flexDirection: "row", alignItems: "center" },
    // Soft filled pill + muted hairline (no bright gold outline).
    searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: spacing.xl, marginTop: spacing.md, height: 50, paddingLeft: 16, paddingRight: 6, borderRadius: radius.pill,
      backgroundColor: c.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)",
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.mode === "dark" ? "rgba(226,190,110,0.22)" : "rgba(92,83,68,0.18)" },
    searchDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: c.mode === "dark" ? "rgba(255,248,235,0.16)" : "rgba(28,28,28,0.14)" },
    aiInSearch: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.brandTint },
    cityPick: { flexDirection: "row", alignItems: "center", gap: 4, height: 40, paddingRight: 6, maxWidth: 130 },
    cityText: { color: c.text, fontWeight: "600", fontSize: 14, flexShrink: 1 },
    retryBtn: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm, paddingHorizontal: 18, height: 40, borderRadius: radius.pill, backgroundColor: c.brandTint },
    retryText: { color: c.brand, fontWeight: "600", fontSize: 14 },
    cityDrop: { marginTop: spacing.sm, paddingVertical: 4 },
    cityChip: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    greet: { color: c.text, fontSize: 22, fontWeight: "600", letterSpacing: 0.2 },
    greetSub: { color: c.textMuted, fontSize: 13, marginTop: 4 },
    hero: { height: 168, borderRadius: radius.lg, overflow: "hidden" },
    heroImg: { width: "100%", height: "100%" },
    heroScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
    heroText: { position: "absolute", left: 16, bottom: 16, right: 16 },
    heroLabel: { color: c.brand, fontSize: 11, letterSpacing: 2, fontWeight: "600" },
    heroTitle: { color: "#F5F0E6", fontSize: 18, fontWeight: "500", marginTop: 2 },
    section: { color: c.text, fontSize: 19, fontFamily: fonts.displayBold, letterSpacing: 0.4, marginTop: spacing.xl, marginBottom: spacing.sm, paddingHorizontal: spacing.xl },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: spacing.xl },
    chipRow: { paddingHorizontal: spacing.xl, gap: 8 },
    vCard: { width: 190, height: 230, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    vImg: { width: "100%", height: "100%", position: "absolute" },
    vScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" },
    vMeta: { position: "absolute", left: 12, bottom: 12, right: 12 },
    vName: { color: "#F5F0E6", fontSize: 14, fontWeight: "600", marginBottom: 2 },
    vRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    vDot: { color: "rgba(243,244,246,0.7)" },
    vMuted: { color: "rgba(243,244,246,0.85)", fontSize: 11 },
    vPrice: { color: c.brand, fontSize: 13, fontWeight: "700", marginTop: 3 },
    verifiedBadge: { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.brand, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    sampleBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.65)", borderWidth: 1, borderColor: c.brand, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
    verifiedText: { color: c.onBrand, fontSize: 9, fontWeight: "700" },
    combo: { height: 168, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    comboImg: { width: "100%", height: "100%", position: "absolute" },
    comboScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "85%" },
    comboBox: { position: "absolute", left: 16, right: 16, bottom: 16 },
    comboTitle: { color: "#F5F0E6", fontSize: 18, fontWeight: "600" },
    comboDesc: { color: "rgba(243,244,246,0.85)", fontSize: 11, marginTop: 3 },
    comboPrice: { color: c.brand, fontSize: 17, fontWeight: "700" },
    comboOrig: { color: "rgba(243,244,246,0.6)", fontSize: 12, textDecorationLine: "line-through" },
    comboSave: { color: c.success, fontSize: 11, fontWeight: "700" },
    seeAll: { color: c.brand, fontSize: 13, fontWeight: "600" },
    empty: { color: c.textMuted, padding: spacing.md },
  }));

  // Each section loads independently: one failed request (e.g. a dropped tunnel
  // fetch) must not blank the whole screen. Failures surface a Retry state.
  const load = useCallback(async () => {
    lastLoad.current = Date.now(); // also de-dupes the mount + first-focus calls
    const enc = encodeURIComponent;
    const [c, e, ci, v, cb] = await Promise.allSettled([
      api.get("/categories", { auth: false }),
      api.get("/event-types", { auth: false }),
      api.get("/cities", { auth: false }),
      api.get(`/vendors?city=${enc(city)}${category ? `&category=${enc(category)}` : ""}&trending=true&limit=20`, { auth: false }),
      api.get("/combos", { auth: false }),
    ]);
    const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" && Array.isArray(r.value) ? (r.value as any[]) : null);
    if (ok(c)) setCategories(ok(c)!);
    if (ok(e)) setEventTypes(ok(e)!);
    if (ok(ci)) setCities(ok(ci)!);
    if (ok(cb)) setCombos(ok(cb)!);
    const vs = ok(v);
    if (vs) {
      // Dedupe trending by vendor id and avoid repeating the same cover image.
      const seenIds = new Set<string>(); const seenCovers = new Set<string>();
      const uniq: any[] = []; const dupCover: any[] = [];
      for (const x of vs) {
        if (seenIds.has(x.id)) continue; seenIds.add(x.id);
        const alt = (x.gallery || []).find((g: string) => g && !seenCovers.has(g));
        if (x.cover && !seenCovers.has(x.cover)) { seenCovers.add(x.cover); uniq.push(x); }
        else if (alt) { seenCovers.add(alt); uniq.push({ ...x, cover: alt }); }
        else dupCover.push(x);
      }
      const list = [...uniq, ...dupCover];
      // Always include one showcase vendor (Hyderabad) so details can be previewed.
      if (city === "Hyderabad" && (!category || category === SAMPLE_VENDOR.category)) list.unshift(SAMPLE_VENDOR);
      setVendors(list);
    }
    const failed = [c, e, ci, v, cb].filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (failed.length) console.warn("home load:", failed.map((f) => String(f.reason?.message || f.reason)).join(" | "));
    setLoadError(!vs || !ok(c) ? "Couldn\u2019t load Thara right now." : null);
    if (!vs || !ok(c)) lastLoad.current = 0; // let the next focus retry
    setLoading(false); setRefreshing(false);
  }, [city, category]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Refetch when Home regains focus (e.g. back from checkout) if the last load failed or is stale.
  useFocusEffect(useCallback(() => {
    if (Date.now() - lastLoad.current > 60_000) load();
  }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };
  const retry = () => { setLoading(true); load(); };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}>
        {/* Top row: location (left) · THARA wordmark (centre) */}
        <View style={styles.topBar}>
          <View style={styles.topSide}>
            <Pressable testID="city-selector" onPress={() => setCityOpen((o) => !o)} style={styles.cityPick} hitSlop={8}
              accessibilityRole="button" accessibilityLabel={`City: ${city}. Change city`}>
              <Ionicons name="location" size={17} color={colors.brand} />
              <Text style={styles.cityText} numberOfLines={1}>{city}</Text>
              <Ionicons name={cityOpen ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
            </Pressable>
          </View>
          <TharaLogo variant="wordmark" size={36} testID="home-wordmark" />
          <View style={styles.topSide} />
        </View>
        {/* Search pill with rotating hints and Thara AI inside on the right */}
        <View style={styles.searchBar}>
          <Pressable testID="search-btn" onPress={() => router.push("/search")} accessibilityRole="search" accessibilityLabel="Search vendors and services"
            style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" }, pressed && { opacity: 0.7 }]}>
            <Ionicons name="search" size={19} color={colors.brand} style={{ opacity: 0.85 }} />
            <RotatingHint testID="home-search-hint" />
          </Pressable>
          <View style={styles.searchDivider} />
          <Pressable testID="ai-btn" onPress={() => router.push("/ai-chat")} hitSlop={6} accessibilityRole="button" accessibilityLabel="Ask Thara AI"
            style={({ pressed }) => [styles.aiInSearch, pressed && { transform: [{ scale: 0.92 }] }]}>
            <Ionicons name="sparkles" size={17} color={colors.brand} />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.lg }}
          snapToInterval={HERO_W + HERO_GAP} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: spacing.xl }}>
          {HERO_IMAGES.map((src, i) => (
            <View key={i} style={[styles.hero, { width: HERO_W, marginLeft: i === 0 ? 0 : HERO_GAP }]}>
              <Image source={{ uri: src }} style={styles.heroImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.heroScrim} />
              <View style={styles.heroText}>
                <Text style={styles.heroLabel}>{HERO_COPY[i % HERO_COPY.length].label}</Text>
                <Text style={styles.heroTitle}>{HERO_COPY[i % HERO_COPY.length].title}</Text>
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

        {loadError && categories.length === 0 && !loading ? (
          <Pressable testID="home-retry-top" onPress={retry} style={({ pressed }) => [styles.retryBtn, { marginTop: spacing.lg }, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <Ionicons name="refresh" size={16} color={colors.brand} />
            <Text style={styles.retryText}>{loadError} Retry</Text>
          </Pressable>
        ) : null}
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
          <Pressable onPress={() => router.push("/search")} hitSlop={12}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
          vendors.length === 0 ? (
            <View style={{ paddingHorizontal: spacing.xl }}>
              {loadError ? (
                <>
                  <EmptyState compact icon="cloud-offline-outline" title="Couldn\u2019t load vendors" message="Check your connection and try again." />
                  <Pressable testID="home-retry" onPress={retry} style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                    <Ionicons name="refresh" size={16} color={colors.brand} />
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                </>
              ) : (
                <EmptyState compact icon="storefront-outline" title={`No vendors yet in ${city}`} message="We're onboarding partners here — check back soon." />
              )}
            </View>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 14 }}>
            {vendors.map((v) => (
              <Pressable key={v.id} testID={`vendor-card-${v.id}`} onPress={() => router.push(`/vendor/${v.id}`)} style={styles.vCard}>
                <Image source={{ uri: resolveImg(v.cover) }} style={styles.vImg} contentFit="cover" />
                {(v as any).is_sample ? <View style={styles.sampleBadge}><Text style={[styles.verifiedText, { color: colors.brand }]}>SAMPLE</Text></View> : null}
                {v.verified && <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={12} color={colors.onBrand} /><Text style={styles.verifiedText}>Verified</Text></View>}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.88)"]} style={styles.vScrim} />
                <View style={styles.vMeta}>
                  <Text style={styles.vName} numberOfLines={1}>{v.name}</Text>
                  <View style={styles.vRow}>
                    {v.reviews_count > 0 ? <Rating value={v.rating} /> : <Text style={styles.vMuted}>New</Text>}
                    {v.distance_km != null && v.distance_km > 0 && <><Text style={styles.vDot}>•</Text>
                    <Text style={styles.vMuted}>{v.distance_km} km</Text></>}
                  </View>
                  {Number(v.starting_price) > 0 ? <Text style={styles.vPrice}>₹{inr(v.starting_price)}+</Text> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          )
        )}

        <Text style={styles.section}>Combo Packages</Text>
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          {combos.map((cb) => (
            <Pressable key={cb.id} testID={`combo-${cb.id}`} accessibilityRole="button"
              onPress={() => openCombo(cb)}
              style={({ pressed }) => [styles.combo, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Image source={{ uri: resolveImg(cb.cover) }} style={styles.comboImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.92)"]} style={styles.comboScrim} />
              <View style={styles.comboBox}>
                <Text style={styles.comboTitle}>{cb.name}</Text>
                <Text style={styles.comboDesc} numberOfLines={2}>{cb.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  {Number(cb.price) > 0 ? <Text style={styles.comboPrice}>₹{inr(cb.price)}</Text> : null}
                  {Number(cb.original_price) > Number(cb.price) && Number(cb.original_price) > 0 ? <Text style={styles.comboOrig}>₹{inr(cb.original_price)}</Text> : null}
                  {Number(cb.savings) > 0 ? <Text style={styles.comboSave}>Save ₹{inr(cb.savings)}</Text> : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

    </View>
  );
}
