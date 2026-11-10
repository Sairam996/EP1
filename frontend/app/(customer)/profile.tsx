import { View, Text, Pressable, ScrollView, Alert, Linking } from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/api";
import { fonts, spacing, useThemedStyles } from "@/src/theme";
import { Divider, FeatureBand, GoldGlow, ListRow, Section, StatStrip, editorialGold, gutter } from "@/src/components/ui";
import { TharaLogo } from "@/src/components/TharaLogo";
import { useCelebrate } from "@/src/components/Celebration";

type Item = { id: string; icon: string; label: string; sub?: string; soon?: boolean; onPress?: () => void };

const soon = (what: string) => Alert.alert(what, "Coming soon to Thara.");

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut, completeProfile } = useAuth();
  const celebrate = useCelebrate();
  const { colors, effectiveMode } = useTheme();
  const [tier, setTier] = useState<any>(null);
  useEffect(() => { if (user?.role === "customer") api.get("/me/tier").then(setTier).catch(() => {}); }, [user]);

  const u: any = user || {};
  const realEmail = u.email && !String(u.email).endsWith("@phone.thara.app") ? u.email : null;
  const initials = String(u.name || "T").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const checks = [!!u.name && !String(u.name).startsWith("+"), !!realEmail, !!u.phone, !!u.city, !!u.avatar];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const isVendor = u.role === "vendor";

  const handleSignOut = () => Alert.alert("Sign out?", "You can log back in anytime with your phone number.", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: async () => { await signOut(); router.replace("/(auth)/login"); } },
  ]);

  const becomeVendor = () => Alert.alert("Become a Thara partner", "List your services and receive bookings. Switch this account to vendor mode?", [
    { text: "Not now", style: "cancel" },
    { text: "Continue", onPress: async () => {
      try {
        await completeProfile({ name: u.name, email: realEmail || undefined, city: u.city, role: "vendor" });
        celebrate({ intensity: "big", title: "Welcome, Thara Partner", subtitle: "Set up your services to start receiving bookings.", icon: "ribbon" });
        router.replace("/(vendor)/dashboard");
      } catch (e: any) { Alert.alert("Couldn't switch", e?.message || "Please try again."); }
    } },
  ]);

  const gold = editorialGold(colors);
  const s = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    hero: { alignItems: "center", paddingHorizontal: gutter, paddingTop: spacing.lg },
    glowWrap: { width: 112, height: 112, alignItems: "center", justifyContent: "center" },
    avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: c.mode === "dark" ? "rgba(226,190,110,0.75)" : "rgba(140,106,38,0.7)", alignItems: "center", justifyContent: "center", padding: 4 },
    avatar: { width: 90, height: 90, borderRadius: 45 },
    initials: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
    initialsT: { color: c.mode === "dark" ? "#E2BE6E" : "#8C6A26", fontFamily: fonts.display, fontSize: 40, letterSpacing: 3 },
    name: { color: c.text, fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 42, marginTop: 14, letterSpacing: 0.4, textAlign: "center" },
    meta: { color: c.textMuted, fontSize: 12.5, marginTop: 4, letterSpacing: 0.3, textAlign: "center" },
    badges: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
    badgeT: { color: c.mode === "dark" ? "#E2BE6E" : "#8C6A26", fontSize: 12, fontWeight: "600", letterSpacing: 1.6, textTransform: "uppercase" },
    dot: { color: c.textMuted, fontSize: 12 },
    progWrap: { width: "72%", marginTop: 18, alignItems: "center" },
    progT: { color: c.textMuted, fontSize: 11.5, letterSpacing: 0.4, marginBottom: 8 },
    progBar: { width: "100%", height: 2, borderRadius: 1, backgroundColor: c.mode === "dark" ? "rgba(226,190,110,0.15)" : "rgba(140,106,38,0.15)", overflow: "hidden" },
    progFill: { height: 2, borderRadius: 1, backgroundColor: c.mode === "dark" ? "#E2BE6E" : "#8C6A26" },
    stats: { marginHorizontal: gutter, marginTop: spacing.xxl },
    signOut: { alignSelf: "center", marginTop: spacing.xxxl, paddingVertical: 10, paddingHorizontal: 24 },
    signOutT: { color: c.textMuted, fontSize: 14, fontWeight: "600", letterSpacing: 1.2 },
    foot: { alignItems: "center", marginTop: spacing.md, opacity: 0.75 },
    ver: { color: c.textMuted, fontSize: 10.5, marginTop: 8, letterSpacing: 2 },
  }));

  const [counts, setCounts] = useState<{ bookings?: number; saved?: number; threads?: number }>({});
  useEffect(() => {
    if (!user || user.role !== "customer") return;
    api.get("/bookings").then((b: any) => setCounts((x) => ({ ...x, bookings: Array.isArray(b) ? b.length : undefined }))).catch(() => {});
    api.get("/favorites").then((f: any) => setCounts((x) => ({ ...x, saved: Array.isArray(f) ? f.length : undefined }))).catch(() => {});
    api.get("/chat/threads").then((t: any) => setCounts((x) => ({ ...x, threads: Array.isArray(t) ? t.length : undefined }))).catch(() => {});
  }, [user]);
  const points = typeof tier?.balance === "number" ? tier.balance : undefined;
  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("en-IN") : undefined);
  const version = Constants.expoConfig?.version || "1.0.0";

  const sections: { title: string; items: Item[] }[] = [
    { title: "MY CELEBRATIONS", items: [
      { id: "bookings", icon: "calendar-outline", label: "My Bookings", sub: "Upcoming & past events", onPress: () => router.push("/(customer)/bookings") },
      { id: "fav", icon: "heart-outline", label: "Saved & Shortlists", sub: "Vendors you loved", onPress: () => router.push("/favorites") },
      { id: "inq", icon: "chatbubbles-outline", label: "My Enquiries", sub: "Conversations with vendors", onPress: () => router.push("/(customer)/chat") },
      { id: "planner", icon: "list-outline", label: "Event Checklist & Budget", soon: true, onPress: () => soon("Event checklist") },
    ] },
    { title: "REWARDS", items: [
      { id: "pts", icon: "diamond-outline", label: "Thara Points", sub: tier?.tier ? `${tier.tier.name} member` : "Earn on every booking", onPress: () => router.push("/points") },
      { id: "ref", icon: "gift-outline", label: "Refer & Earn", sub: "200 pts per friend", onPress: () => router.push("/referrals") },
    ] },
    { title: "ACCOUNT", items: [
      { id: "city", icon: "location-outline", label: "Cities & Addresses", sub: u.city || "Hyderabad", soon: true, onPress: () => soon("Saved addresses") },
      { id: "pay", icon: "card-outline", label: "Payment Methods", soon: true, onPress: () => soon("Saved payment methods") },
      { id: "notif", icon: "notifications-outline", label: "Notifications", onPress: () => router.push("/settings") },
      { id: "appearance", icon: effectiveMode === "dark" ? "moon-outline" : "sunny-outline", label: "Appearance", sub: `${effectiveMode === "dark" ? "Dark" : "Light"} theme`, onPress: () => router.push("/settings") },
    ] },
    { title: "SUPPORT", items: [
      { id: "ai", icon: "sparkles-outline", label: "Ask Thara AI", sub: "Plan with our assistant", onPress: () => router.push("/ai-chat") },
      { id: "help", icon: "help-buoy-outline", label: "Help & Support", sub: "support@thara.app", onPress: () => Linking.openURL("mailto:support@thara.app?subject=Thara%20support").catch(() => soon("Support")) },
      { id: "terms", icon: "document-text-outline", label: "Terms & Privacy", onPress: () => Linking.openURL("https://thara.app/terms") },
    ] },
  ];

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: "center" }}>
        <TharaLogo variant="wordmark" size={30} />
      </View>

      <View style={s.hero}>
        <View style={s.glowWrap}>
          <GoldGlow size={230} />
          <View style={s.avatarRing}>
            {u.avatar ? <Image source={{ uri: u.avatar }} style={s.avatar} contentFit="cover" />
              : <View style={s.initials}><Text style={s.initialsT}>{initials}</Text></View>}
          </View>
        </View>
        <Text style={s.name} numberOfLines={1}>{u.name || "Guest"}</Text>
        <Text style={s.meta}>{[u.phone, realEmail].filter(Boolean).join("   ·   ")}</Text>
        <View style={s.badges}>
          <Text style={s.badgeT}>{u.city || "Hyderabad"}</Text>
          {tier?.tier ? (
            <>
              <Text style={s.dot}>·</Text>
              <Pressable testID="tier-badge" onPress={() => router.push("/points")} hitSlop={8}>
                <Text style={s.badgeT}>{tier.tier.name} Member</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        {pct < 100 ? (
          <Pressable style={s.progWrap} onPress={() => router.push("/settings")} testID="profile-progress">
            <Text style={s.progT}>Profile {pct}% complete  ·  <Text style={{ color: gold, fontWeight: "600" }}>Finish</Text></Text>
            <View style={s.progBar}><View style={[s.progFill, { width: `${pct}%` }]} /></View>
          </Pressable>
        ) : null}
      </View>

      <View style={s.stats}>
        <Divider />
        <StatStrip items={[
          { id: "q-book", value: fmt(counts.bookings), icon: "calendar-outline", label: "Bookings", onPress: () => router.push("/(customer)/bookings") },
          { id: "q-fav", value: fmt(counts.saved), icon: "heart-outline", label: "Saved", onPress: () => router.push("/favorites") },
          { id: "q-msg", value: fmt(counts.threads), icon: "chatbubbles-outline", label: "Messages", onPress: () => router.push("/(customer)/chat") },
          { id: "q-pts", value: fmt(points), icon: "diamond-outline", label: "Points", onPress: () => router.push("/points") },
        ]} />
        <Divider />
      </View>

      <FeatureBand testID="vendor-mode"
        onPress={isVendor ? () => router.replace("/(vendor)/dashboard") : becomeVendor}
        eyebrow={isVendor ? "Partner" : "For vendors"}
        title={isVendor ? "Your Vendor Dashboard" : "Become a Thara Partner"}
        subtitle={isVendor ? "Manage bookings, services & calendar" : "List your services and get bookings in Hyderabad"}
        cta={isVendor ? "Open dashboard" : "Start listing"}
        icon={isVendor ? "storefront-outline" : "ribbon-outline"} />

      {sections.map((sec) => (
        <Section key={sec.title} eyebrow={sec.title}>
          <Divider />
          {sec.items.map((it, i) => (
            <ListRow key={it.id} testID={`menu-${it.id}`} icon={it.icon as any} title={it.label} subtitle={it.sub}
              soon={it.soon} onPress={it.onPress} last={i === sec.items.length - 1} />
          ))}
        </Section>
      ))}

      <Pressable testID="signout-btn" onPress={handleSignOut} style={({ pressed }) => [s.signOut, pressed && { opacity: 0.5 }]} accessibilityRole="button">
        <Text style={s.signOutT}>Sign out</Text>
      </Pressable>

      <View style={s.foot}>
        <TharaLogo variant="star" height={22} />
        <Text style={s.ver}>THARA  ·  VERSION {version}</Text>
      </View>
    </ScrollView>
  );
}
