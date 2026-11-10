import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, resolveImg } from "@/src/api";
import { GoldButton, Rating } from "@/src/components/UI";
import { EmptyState, PressableScale, SoftChip, SectionTitle } from "@/src/components/Polish";
import { useUserLocation, openInMaps } from "@/src/hooks/use-location";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing, useThemedStyles } from "@/src/theme";
import { Alert } from "react-native";
import { SAMPLE_VENDOR, SAMPLE_VENDOR_ID, SAMPLE_REVIEWS, SAMPLE_SERVICES } from "@/src/sampleVendor";
import { AvailabilityCalendar } from "@/src/components/AvailabilityCalendar";
import { HeartPop, hapticLight } from "@/src/components/Celebration";

const { width } = Dimensions.get("window");

export default function VendorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const { colors } = useTheme();
  const [v, setV] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [tab, setTab] = useState<"about" | "packages" | "reviews" | "gallery">("about");
  const [favorited, setFavorited] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [loadErr, setLoadErr] = useState(false);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    loader: { flex: 1, backgroundColor: c.surface, justifyContent: "center" },
    heroScrim: { position: "absolute", top: 200, left: 0, right: 0, height: 200 },
    iconCircle: { position: "absolute", width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
    heroText: { position: "absolute", top: 240, left: 16, right: 16 },
    name: { color: "#F5F0E6", fontSize: 28, fontFamily: fonts.displayBold, letterSpacing: 0.4 },
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
    pkgCard: { padding: spacing.md, backgroundColor: c.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
    pkgTitle: { color: c.text, fontSize: 15, fontWeight: "600" },
    pkgPrice: { color: c.brand, fontSize: 16, fontWeight: "700" },
    pkgBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.brand },
    pkgBtnT: { color: c.onBrand, fontWeight: "600", fontSize: 13 },
  }));

  useEffect(() => {
    if (id === SAMPLE_VENDOR_ID) {
      setV(SAMPLE_VENDOR); setReviews(SAMPLE_REVIEWS); setServices(SAMPLE_SERVICES); setSimilar([]); setLoadErr(false);
      return;
    }
    const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
    // Load independently so a reviews/similar failure cannot blank the whole page.
    api.get(`/vendors/${id}${q}`, { auth: false })
      .then((vd) => { setV(vd); setLoadErr(false); })
      .catch(() => setLoadErr(true));
    api.get(`/vendors/${id}/reviews`, { auth: false })
      .then((r) => setReviews(r || []))
      .catch(() => setReviews([]));
    api.get(`/vendors/${id}/similar`, { auth: false })
      .then((s) => setSimilar(s || []))
      .catch(() => setSimilar([]));
    api.get(`/vendors/${id}/services`, { auth: false }).then((x) => setServices(x || [])).catch(() => setServices([]));
  }, [id, coords]);

  const isSample = id === SAMPLE_VENDOR_ID;
  const sampleNote = () => Alert.alert("Sample listing", "This is a preview vendor to show how listings look on Thara. Booking opens with real partners.");
  const book = (path: string) => (isSample ? sampleNote() : router.push(path as any));
  const toggleFav = async () => {
    hapticLight();
    const next = !favorited;
    setFavorited(next); // optimistic so the heart pops instantly
    if (isSample) return;
    try { const r = await api.post(`/favorites/${id}`); setFavorited(!!r.favorited); } catch { setFavorited(!next); }
  };

  if (loadErr && !v) return <View style={styles.loader}><EmptyState icon="cloud-offline-outline" title="Couldn't load this vendor" message="Check your connection and try again." ctaTitle="Go back" ghost onCta={() => router.back()} /></View>;
  if (!v) return <View style={styles.loader}><ActivityIndicator color={colors.brand} /></View>;

  const gallery: string[] = v.gallery || [];
  const facilities: string[] = v.facilities || [];
  const team: any[] = Array.isArray(v.team) ? v.team : Array.isArray(v.team_members) ? v.team_members : [];
  const avg = reviews.length ? reviews.reduce((a, x) => a + (Number(x.rating) || 0), 0) / reviews.length : Number(v.rating) || 0;
  const dist = [5, 4, 3, 2, 1].map((n) => reviews.filter((x) => Math.round(Number(x.rating)) === n).length);
  const startPrice = Number(v.starting_price || 0);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {gallery.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setHeroIdx(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {gallery.map((src: string, i: number) => (
              <Image key={i} source={{ uri: resolveImg(src) }} style={{ width, height: 340 }} contentFit="cover" transition={250} />
            ))}
          </ScrollView>
        ) : (
          <View style={{ width, height: 340, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="images-outline" size={44} color={colors.brand} />
          </View>
        )}
        {gallery.length > 0 && (
          <PressableScale testID="show-all-photos" onPress={() => setTab("gallery")} accessibilityLabel="Show all photos"
            style={{ position: "absolute", top: 196, right: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 2 }}>
            <Ionicons name="grid-outline" size={13} color="#F5F0E6" />
            <Text style={{ color: "#F5F0E6", fontSize: 12, fontWeight: "600" }}>{heroIdx + 1}/{gallery.length} · All photos</Text>
          </PressableScale>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.95)"]} style={styles.heroScrim} />
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Back" style={[styles.iconCircle, { top: insets.top + 8, left: 16 }]}>
          <Ionicons name="arrow-back" size={20} color="#F5F0E6" />
        </Pressable>
        <Pressable testID="fav-btn" onPress={toggleFav} hitSlop={8} style={[styles.iconCircle, { top: insets.top + 8, right: 16 }]}>
          <HeartPop active={favorited}>
            <Ionicons name={favorited ? "heart" : "heart-outline"} size={20} color={favorited ? colors.error : "#F3F4F6"} />
          </HeartPop>
        </Pressable>
        <View style={styles.heroText}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {v.verified && <View style={styles.verBadge}><Ionicons name="checkmark-circle" size={12} color={colors.onBrand} /><Text style={styles.verT}>Verified</Text></View>}
            {v.founding_vendor && <View style={styles.verBadge}><Ionicons name="star" size={12} color={colors.onBrand} /><Text style={styles.verT}>Founding Vendor · {v.city}</Text></View>}
          </View>
          <Text style={styles.name}>{v.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {v.reviews_count > 0 ? <><Rating value={v.rating} size={14} />
            <Text style={styles.muted}>({v.reviews_count} reviews)</Text></> : <Text style={styles.muted}>New on Thara</Text>}
            {v.distance_km != null && v.distance_km > 0 && <><Text style={styles.muted}>•</Text>
            <Text style={styles.muted}>{v.distance_km} km</Text></>}
          </View>
          <Text style={[styles.muted, { marginTop: 4 }]}>{v.city} • {v.category}</Text>
        </View>

        <View style={styles.tabRow}>
          {(["about", "packages", "reviews", "gallery"] as const).map((t) => (
            <Pressable key={t} testID={`tab-${t}`} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabT, tab === t && styles.tabActiveText]}>{t[0].toUpperCase() + t.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "about" && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
            {services[0] ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.pkgTitle}>{services[0].title}</Text>
                {services[0].description ? <Text style={styles.reviewText} numberOfLines={3}>{services[0].description}</Text> : null}
              </View>
            ) : null}
            {v.description ? <Text style={styles.body}>{v.description}</Text> : <SoftChip icon="document-text-outline" label="Description not listed yet" />}

            <View>
              <SectionTitle icon="star" title="Ratings" right={reviews.length ? <Pressable onPress={() => setTab("reviews")}><Text style={{ color: colors.brand, fontSize: 12 }}>See all</Text></Pressable> : undefined} />
              {reviews.length > 0 || v.reviews_count > 0 ? (
                <View style={[styles.review, { flexDirection: "row", gap: spacing.lg, alignItems: "center" }]}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontSize: 32, fontWeight: "700" }}>{avg.toFixed(1)}</Text>
                    <Rating value={avg} size={12} />
                    <Text style={styles.empty}>{v.reviews_count || reviews.length} reviews</Text>
                  </View>
                  {reviews.length > 0 && <View style={{ flex: 1, gap: 4 }}>
                    {dist.map((n, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.empty, { width: 10, fontSize: 11 }]}>{5 - i}</Text>
                        <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface3 }}>
                          <View style={{ width: `${(n / reviews.length) * 100}%`, height: 5, borderRadius: 3, backgroundColor: colors.brand }} />
                        </View>
                      </View>
                    ))}
                  </View>}
                </View>
              ) : <SoftChip icon="sparkles-outline" label="New on Thara — no ratings yet" />}
            </View>

            <View>
              <SectionTitle icon="people" title="Team" />
              {team.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {team.map((m: any, i: number) => (
                    <View key={m.id ?? i} style={{ width: 92, alignItems: "center", gap: 4 }}>
                      {m.photo || m.avatar ? <Image source={{ uri: resolveImg(m.photo || m.avatar) }} style={{ width: 64, height: 64, borderRadius: 32 }} contentFit="cover" />
                        : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandTint, alignItems: "center", justifyContent: "center" }}><Ionicons name="person" size={26} color={colors.brand} /></View>}
                      <Text style={styles.simName} numberOfLines={1}>{m.name ?? "Team member"}</Text>
                      {m.role ? <Text style={[styles.empty, { fontSize: 11 }]} numberOfLines={1}>{m.role}</Text> : null}
                    </View>
                  ))}
                </ScrollView>
              ) : <SoftChip icon="people-outline" label="Team not listed yet" />}
            </View>

            <View>
              <SectionTitle icon="checkmark-done" title="Facilities" />
              {facilities.length === 0 ? <SoftChip icon="list-outline" label="Facilities not listed yet" /> : null}
              <View style={styles.facWrap}>
                {facilities.map((f: string) => (
                  <View key={f} style={styles.fac}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.brand} />
                    <Text style={styles.facText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
            {Array.isArray(v.blocked_dates) ? <AvailabilityCalendar blocked={v.blocked_dates} /> : null}
            <View>
              <Text style={styles.h3}>Starting at</Text>
              <Text style={styles.priceBig}>₹{startPrice.toLocaleString("en-IN")}</Text>
              <Text style={styles.empty}>Pick an available date on the next step.</Text>
            </View>
            {v.lat != null && v.lng != null && (
              <View>
                <Text style={styles.h3}>Location</Text>
                <View style={styles.locCard}>
                  <Ionicons name="location" size={22} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locName} numberOfLines={2}>{v.address || v.city}</Text>
                    {v.distance_km != null && v.distance_km > 0 && <Text style={styles.locDist}>{v.distance_km} km away</Text>}
                  </View>
                  <View style={{ gap: 6, alignItems: "flex-end" }}>
                    <Pressable testID="in-app-nav" onPress={() => (isSample ? openInMaps(v.lat, v.lng, v.name) : router.push(`/navigate/${v.id}` as any))} style={styles.dirBtn}>
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

        {tab === "packages" && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.lg }}>
            {services.length === 0 ? <EmptyState compact icon="pricetags-outline" title="Packages coming soon" message="Book now to get a custom quote." /> :
              services.map((s) => (
                <View key={s.id} style={styles.pkgCard} testID={`pkg-${s.id}`}>
                  {s.photos?.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {s.photos.map((p: string, i: number) => (
                        <Image key={i} source={{ uri: resolveImg(p) }} style={{ width: 120, height: 90, borderRadius: radius.sm }} contentFit="cover" />
                      ))}
                    </ScrollView>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: s.photos?.length ? 10 : 0 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pkgTitle}>{s.title}</Text>
                      {s.description ? <Text style={styles.reviewText}>{s.description}</Text> : null}
                    </View>
                    <Text style={styles.pkgPrice}>₹{Number(s.price).toLocaleString("en-IN")}</Text>
                  </View>
                  <PressableScale onPress={() => book(`/booking-form/${v.id}?serviceId=${s.id}`)} style={styles.pkgBtn} testID={`pkg-book-${s.id}`}>
                    <Text style={styles.pkgBtnT}>Select & Book</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.onBrand} />
                  </PressableScale>
                </View>
              ))}
          </View>
        )}

        {tab === "reviews" && (
          <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.lg }}>
            {reviews.length === 0 ? <EmptyState compact icon="chatbubbles-outline" title="No reviews yet" message="Be among the first to celebrate with this vendor." /> :
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
            {gallery.length === 0 && <View style={{ flex: 1 }}><EmptyState compact icon="images-outline" title="Photos coming soon" /></View>}
            {gallery.map((src: string, i: number) => (
              <Image key={i} transition={200} source={{ uri: resolveImg(src) }} style={{ width: (width - spacing.xl * 2 - 8) / 2, height: 140, borderRadius: radius.md }} contentFit="cover" />
            ))}
          </View>
        )}

        {similar.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[styles.h3, { paddingHorizontal: spacing.xl }]}>Similar vendors</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: 12, paddingTop: 12 }}>
              {similar.map((s) => (
                <PressableScale key={s.id} onPress={() => router.replace(`/vendor/${s.id}`)} style={styles.simCard}>
                  <Image source={{ uri: resolveImg(s.cover) }} style={{ width: "100%", height: 100 }} contentFit="cover" />
                  <View style={{ padding: 10 }}>
                    <Text style={styles.simName} numberOfLines={1}>{s.name}</Text>
                    {s.reviews_count > 0 && <Rating value={s.rating} size={12} />}
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaLabel}>Starting</Text>
          <Text style={styles.ctaPrice}>₹{startPrice.toLocaleString("en-IN")}</Text>
        </View>
        <GoldButton testID="book-now-btn" title="Book Now" onPress={() => book(`/booking-form/${v.id}`)} style={{ minWidth: 160 }} />
      </View>
    </View>
  );
}
