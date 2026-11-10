import { View, Text, Pressable, ScrollView, Alert, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/api";
import { fonts, radius, spacing, useThemedStyles } from "@/src/theme";
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

  const s = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    hero: { marginHorizontal: spacing.xl, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: c.mode === "dark" ? "rgba(226,190,110,0.35)" : "rgba(140,106,38,0.25)" },
    heroIn: { padding: 20, alignItems: "center" },
    avatarRing: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: c.brand, alignItems: "center", justifyContent: "center", padding: 3 },
    avatar: { width: 82, height: 82, borderRadius: 41 },
    initials: { width: 82, height: 82, borderRadius: 41, backgroundColor: c.brandTint, alignItems: "center", justifyContent: "center" },
    initialsT: { color: c.brand, fontFamily: fonts.displayBold, fontSize: 34, letterSpacing: 2 },
    name: { color: c.text, fontFamily: fonts.displayBold, fontSize: 28, marginTop: 10, letterSpacing: 0.4 },
    meta: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    chips: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
    chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.brand, backgroundColor: c.brandTint },
    chipT: { color: c.brand, fontSize: 12, fontWeight: "600" },
    progWrap: { width: "100%", marginTop: 16 },
    progRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    progT: { color: c.textSubtle, fontSize: 12, fontWeight: "600" },
    progBar: { height: 6, borderRadius: 3, backgroundColor: c.surface3, overflow: "hidden" },
    progFill: { height: 6, borderRadius: 3, backgroundColor: c.brand },
    quick: { flexDirection: "row", gap: 10, marginHorizontal: spacing.xl, marginTop: spacing.lg },
    qBtn: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    qT: { color: c.text, fontSize: 12, fontWeight: "600" },
    vendorCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, borderRadius: radius.lg, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.brand },
    vendorT: { color: c.onBrand, fontFamily: fonts.displayBold, fontSize: 20 },
    vendorS: { color: c.onBrand, fontSize: 12, opacity: 0.8, marginTop: 2 },
    secT: { color: c.brand, fontSize: 11, letterSpacing: 2, fontWeight: "700", marginTop: spacing.xl, marginBottom: 8, marginHorizontal: spacing.xl + 4 },
    group: { marginHorizontal: spacing.xl, borderRadius: radius.lg, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, minHeight: 56, paddingVertical: 10 },
    rowDiv: { borderTopWidth: 1, borderTopColor: c.divider },
    ico: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.brandTint, alignItems: "center", justifyContent: "center" },
    lbl: { color: c.text, fontSize: 15, fontWeight: "500" },
    sub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    soon: { color: c.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1, borderWidth: 1, borderColor: c.brand, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
    signOut: { marginHorizontal: spacing.xl, marginTop: spacing.xl, minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: c.error + "66", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    signOutT: { color: c.error, fontSize: 15, fontWeight: "700" },
    foot: { alignItems: "center", marginTop: spacing.xl, opacity: 0.8 },
    ver: { color: c.textMuted, fontSize: 11, marginTop: 6, letterSpacing: 1 },
  }));

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
    <ScrollView style={s.root} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
        <TharaLogo variant="wordmark" size={30} />
      </View>

      <View style={s.hero}>
        <LinearGradient colors={colors.mode === "dark" ? ["#16120A", "#070707"] : ["#FFFCF5", "#F3E7CF"]} style={s.heroIn}>
          <View style={s.avatarRing}>
            {u.avatar ? <Image source={{ uri: u.avatar }} style={s.avatar} contentFit="cover" />
              : <View style={s.initials}><Text style={s.initialsT}>{initials}</Text></View>}
          </View>
          <Text style={s.name} numberOfLines={1}>{u.name || "Guest"}</Text>
          <Text style={s.meta}>{[u.phone, realEmail].filter(Boolean).join("  ·  ")}</Text>
          <View style={s.chips}>
            <View style={s.chip}><Ionicons name="location" size={12} color={colors.brand} /><Text style={s.chipT}>{u.city || "Hyderabad"}</Text></View>
            {tier?.tier ? (
              <Pressable testID="tier-badge" onPress={() => router.push("/points")} style={s.chip}>
                <Ionicons name={tier.tier.icon} size={12} color={colors.brand} /><Text style={s.chipT}>{tier.tier.name} Member</Text>
              </Pressable>
            ) : null}
          </View>
          {pct < 100 ? (
            <Pressable style={s.progWrap} onPress={() => router.push("/settings")} testID="profile-progress">
              <View style={s.progRow}><Text style={s.progT}>Complete your profile</Text><Text style={[s.progT, { color: colors.brand }]}>{pct}%</Text></View>
              <View style={s.progBar}><View style={[s.progFill, { width: `${pct}%` }]} /></View>
            </Pressable>
          ) : null}
        </LinearGradient>
      </View>

      <View style={s.quick}>
        {[
          { id: "q-book", icon: "calendar", label: "Bookings", go: "/(customer)/bookings" },
          { id: "q-fav", icon: "heart", label: "Saved", go: "/favorites" },
          { id: "q-msg", icon: "chatbubbles", label: "Messages", go: "/(customer)/chat" },
          { id: "q-pts", icon: "diamond", label: "Points", go: "/points" },
        ].map((q) => (
          <Pressable key={q.id} testID={q.id} onPress={() => router.push(q.go as any)} style={({ pressed }) => [s.qBtn, pressed && { opacity: 0.8 }]}>
            <Ionicons name={q.icon as any} size={22} color={colors.brand} />
            <Text style={s.qT}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable testID="vendor-mode" onPress={isVendor ? () => router.replace("/(vendor)/dashboard") : becomeVendor}
        style={({ pressed }) => [s.vendorCard, pressed && { opacity: 0.9 }]}>
        <Ionicons name={isVendor ? "storefront" : "briefcase"} size={28} color={colors.onBrand} />
        <View style={{ flex: 1 }}>
          <Text style={s.vendorT}>{isVendor ? "Switch to Vendor Dashboard" : "Become a Thara Partner"}</Text>
          <Text style={s.vendorS}>{isVendor ? "Manage bookings, services & calendar" : "List your services and get bookings in Hyderabad"}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.onBrand} />
      </Pressable>

      {sections.map((sec) => (
        <View key={sec.title}>
          <Text style={s.secT}>{sec.title}</Text>
          <View style={s.group}>
            {sec.items.map((it, i) => (
              <Pressable key={it.id} testID={`menu-${it.id}`} onPress={it.onPress}
                style={({ pressed }) => [s.row, i > 0 && s.rowDiv, pressed && { opacity: 0.7 }]}>
                <View style={s.ico}><Ionicons name={it.icon as any} size={18} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.lbl}>{it.label}</Text>
                  {it.sub ? <Text style={s.sub}>{it.sub}</Text> : null}
                </View>
                {it.soon ? <Text style={s.soon}>SOON</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable testID="signout-btn" onPress={handleSignOut} style={({ pressed }) => [s.signOut, pressed && { opacity: 0.7 }]}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={s.signOutT}>Sign out</Text>
      </Pressable>

      <View style={s.foot}>
        <TharaLogo variant="star" height={26} />
        <Text style={s.ver}>INDIAN EVENTS. TIMELESS BEAUTY.</Text>
      </View>
    </ScrollView>
  );
}
