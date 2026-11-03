import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, ScrollView, Keyboard } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, resolveImg } from "@/src/api";
import { Rating, Pill } from "@/src/components/UI";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { fonts, radius, spacing, useThemedStyles } from "@/src/theme";
import { EmptyState } from "@/src/components/Polish";
import { SAMPLE_VENDOR, SAMPLE_SERVICES } from "@/src/sampleVendor";

const MIN_CHARS = 2;
const RECENT_KEY = "thara.recentSearches";
const SUGGESTIONS = [
  { label: "Wedding venues", q: "venue", icon: "business-outline" },
  { label: "Sangeet decor", q: "decor", icon: "color-palette-outline" },
  { label: "Photographers", q: "photo", icon: "camera-outline" },
  { label: "Catering", q: "catering", icon: "restaurant-outline" },
  { label: "Mehendi", q: "mehendi", icon: "hand-left-outline" },
  { label: "Haldi", q: "haldi", icon: "sunny-outline" },
];
const SAMPLE = { ...SAMPLE_VENDOR, services: SAMPLE_SERVICES };

/** Text a vendor can be matched on: name, category, city, description, facilities, services. */
const haystack = (v: any) => [v.name, v.category, v.city, v.description, ...(v.facilities || []), ...(v.event_types || []),
  ...((v.services || []) as any[]).flatMap((s) => [s.title, s.description])].filter(Boolean).join(" ").toLowerCase();
const matches = (v: any, q: string) => q.toLowerCase().split(/\s+/).filter(Boolean).every((t) => haystack(v).includes(t));

export default function Search() {
  const insets = useSafeAreaInsets();
  const { event_type } = useLocalSearchParams<{ event_type?: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const city = (user as any)?.city || "Hyderabad";
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [base, setBase] = useState<any[]>([]);       // vendors for current category / event type
  const [remote, setRemote] = useState<any[]>([]);   // server-side matches for q
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: spacing.lg, paddingRight: 64 },
    back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: 56, backgroundColor: c.surface2, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong },
    input: { flex: 1, color: c.text, fontSize: 17, height: 56 },
    card: { flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    img: { width: 110, height: 110 },
    cardName: { color: c.text, fontSize: 16, fontWeight: "600" },
    cardMeta: { color: c.textMuted, fontSize: 12, textTransform: "capitalize" },
    cardSvc: { color: c.textSubtle, fontSize: 12 },
    cardPrice: { color: c.brand, fontSize: 14, fontWeight: "700", marginTop: 4 },
    secT: { color: c.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 10, marginTop: spacing.lg },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    sChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    sChipT: { color: c.text, fontSize: 14, fontWeight: "500" },
    recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    recentT: { color: c.text, fontSize: 15, flex: 1 },
    clear: { color: c.textMuted, fontSize: 12 },
    tip: { color: c.textMuted, fontSize: 13, marginTop: spacing.xl, textAlign: "center" },
    trendCard: { width: 150, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    trendName: { color: c.text, fontWeight: "600", fontSize: 13 },
    hint: { color: c.textMuted, fontSize: 13, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
    title: { color: c.text, fontFamily: fonts.displayBold, fontSize: 22 },
  }));

  useEffect(() => { api.get("/categories", { auth: false }).then(setCats).catch(() => {}); }, []);
  useEffect(() => { AsyncStorage.getItem(RECENT_KEY).then((r) => r && setRecent(JSON.parse(r))).catch(() => {}); }, []);

  // Base list for category / event type (no text) — used for instant local filtering + trending.
  useEffect(() => {
    let live = true; setLoading(true);
    const p = new URLSearchParams({ city });
    if (cat) p.append("category", cat);
    if (event_type) p.append("event_type", String(event_type));
    api.get(`/vendors?${p.toString()}`, { auth: false })
      .then((v) => { if (live) setBase(v || []); })
      .catch(() => { if (live) setBase([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [cat, event_type, city]);

  const term = q.trim();
  const active = term.length >= MIN_CHARS;

  // Light debounce for server-side matches (services, other cities).
  useEffect(() => {
    if (!active) { setRemote([]); setSearching(false); return; }
    let live = true; setSearching(true);
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q: term });
      if (cat) p.append("category", cat);
      if (event_type) p.append("event_type", String(event_type));
      api.get(`/vendors?${p.toString()}`, { auth: false })
        .then((v) => { if (live) setRemote(v || []); })
        .catch(() => { if (live) setRemote([]); })
        .finally(() => { if (live) setSearching(false); });
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [term, active, cat, event_type]);

  const pool = useMemo(() => {
    const withSample = (!cat || cat === SAMPLE.category) && !event_type ? [SAMPLE, ...base] : base;
    const seen = new Set<string>();
    return withSample.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
  }, [base, cat, event_type]);

  const results = useMemo(() => {
    if (!active) return pool;
    const local = pool.filter((v) => matches(v, term));
    const ids = new Set(local.map((v) => v.id));
    return [...local, ...remote.filter((v) => !ids.has(v.id))];
  }, [active, pool, remote, term]);

  const saveRecent = (text: string) => {
    const t = text.trim(); if (t.length < MIN_CHARS) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    setRecent(next); AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };
  const openVendor = (id: string) => { saveRecent(q); Keyboard.dismiss(); router.push(`/vendor/${id}`); };
  const browsing = !active && (cat || event_type);   // category/event filter with no text → show list

  const renderCard = ({ item }: { item: any }) => {
    const svc = active ? (item.services || []).find((s: any) => matches({ name: s.title, description: s.description }, term)) : null;
    const price = Number(item.starting_price);
    return (
      <Pressable testID={`result-${item.id}`} onPress={() => openVendor(item.id)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
        <Image source={{ uri: resolveImg(item.cover) }} style={styles.img} contentFit="cover" />
        <View style={{ flex: 1, padding: spacing.md, gap: 3 }}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.category} • {item.city}{item.is_sample ? " • Sample" : ""}</Text>
          {svc ? <Text style={styles.cardSvc} numberOfLines={1}>Package: {svc.title}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 }}>
            {item.reviews_count > 0 ? <Rating value={item.rating} size={12} /> : <Text style={styles.cardMeta}>New</Text>}
            {item.distance_km != null && item.distance_km > 0 && <Text style={styles.cardMeta}>• {item.distance_km} km</Text>}
          </View>
          {price > 0 ? <Text style={styles.cardPrice}>₹{price.toLocaleString("en-IN")}+</Text> : null}
        </View>
      </Pressable>
    );
  };

  const emptyState = (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {recent.length > 0 ? (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.secT}>RECENT SEARCHES</Text>
            <Pressable hitSlop={10} onPress={() => { setRecent([]); AsyncStorage.removeItem(RECENT_KEY).catch(() => {}); }}><Text style={[styles.clear, { marginTop: spacing.lg }]}>Clear</Text></Pressable>
          </View>
          {recent.map((r) => (
            <Pressable key={r} onPress={() => setQ(r)} style={styles.recentRow} testID={`recent-${r}`}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              <Text style={styles.recentT}>{r}</Text>
              <Ionicons name="arrow-up-outline" size={16} color={colors.textMuted} style={{ transform: [{ rotate: "-45deg" }] }} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={styles.secT}>POPULAR SEARCHES</Text>
      <View style={styles.chipWrap}>
        {SUGGESTIONS.map((sg) => (
          <Pressable key={sg.label} onPress={() => setQ(sg.q)} style={styles.sChip} testID={`suggest-${sg.q}`}>
            <Ionicons name={sg.icon as any} size={16} color={colors.brand} />
            <Text style={styles.sChipT}>{sg.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.secT}>TRENDING IN {city.toUpperCase()}</Text>
      {loading ? <ActivityIndicator color={colors.brand} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
          {pool.slice(0, 8).map((v) => (
            <Pressable key={v.id} onPress={() => openVendor(v.id)} style={styles.trendCard} testID={`trend-${v.id}`}>
              <Image source={{ uri: resolveImg(v.cover) }} style={{ width: "100%", height: 96 }} contentFit="cover" />
              <View style={{ padding: 10, gap: 2 }}>
                <Text style={styles.trendName} numberOfLines={1}>{v.name}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>{v.category}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Text style={styles.tip}>Try ‘palace’, ‘decor’, or a vendor name</Text>
    </ScrollView>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.brand} />
          <TextInput testID="search-input" value={q} onChangeText={setQ} placeholder="Search vendors, services…"
            placeholderTextColor={colors.textMuted} style={styles.input} autoFocus returnKeyType="search"
            onSubmitEditing={() => saveRecent(q)} autoCorrect={false} />
          {q ? <Pressable hitSlop={10} onPress={() => setQ("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable> : null}
        </View>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Pill label="All" active={!cat} onPress={() => setCat(null)} />
          {cats.map((c) => <Pill key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} testID={`s-cat-${c.id}`} />)}
        </ScrollView>
      </View>
      {term.length === 1 ? <Text style={styles.hint}>Keep typing — results appear after {MIN_CHARS} letters</Text> : null}
      {!active && !browsing ? emptyState : loading && !active ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          data={results}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 40, gap: spacing.md }}
          ListHeaderComponent={active ? <Text style={[styles.cardMeta, { marginBottom: 4 }]}>{results.length} result{results.length === 1 ? "" : "s"} for “{term}”{searching ? " · searching…" : ""}</Text> : undefined}
          ListEmptyComponent={searching ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : <EmptyState icon="search-outline" title="No vendors found" message="Try another category, city or keyword." />}
          renderItem={renderCard}
        />
      )}
    </View>
  );
}
