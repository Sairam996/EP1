import { View, Text, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/api";
import { radius, spacing, useThemedStyles } from "@/src/theme";
import { TharaLogo } from "@/src/components/TharaLogo";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { colors, effectiveMode } = useTheme();
  const [tier, setTier] = useState<any>(null);
  useEffect(() => { if (user?.role === "customer") api.get("/me/tier").then(setTier).catch(() => {}); }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    brandBar: { alignItems: "center", marginBottom: spacing.md },
    header: { alignItems: "center", paddingHorizontal: spacing.xl },
    avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: c.brand },
    name: { color: c.text, fontSize: 20, fontWeight: "600", marginTop: spacing.sm, letterSpacing: 0.3 },
    email: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    badge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.brandTint, borderWidth: 1, borderColor: c.brand },
    tierPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, backgroundColor: c.surface2 },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: c.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border },
    lbl: { color: c.text, fontSize: 15, fontWeight: "500", flex: 1 },
    brandTxt: { color: c.brand, fontSize: 12, fontWeight: "600" },
    modeChip: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    modeChipText: { color: c.textSubtle, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" },
  }));

  const items = [
    { id: "settings", icon: "settings-outline", label: "Appearance & Settings", onPress: () => router.push("/settings") },
    { id: "ref", icon: "gift", label: "Refer & Earn — 200 pts per friend", onPress: () => router.push("/referrals") },
    { id: "pts", icon: "diamond", label: "Thara Points", onPress: () => router.push("/points") },
    { id: "fav", icon: "heart", label: "Favorites", onPress: () => router.push("/favorites") },
    { id: "ai", icon: "sparkles", label: "Ask AI Assistant", onPress: () => router.push("/ai-chat") },
    { id: "help", icon: "help-circle", label: "Help & Support", onPress: () => {} },
    { id: "terms", icon: "document-text", label: "Terms & Privacy", onPress: () => {} },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 100 }}>
      <View style={styles.brandBar}>
        <TharaLogo variant="wordmark" width={130} />
      </View>
      <View style={styles.header}>
        <Image source={{ uri: user?.avatar }} style={styles.avatar} contentFit="cover" />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}>
          <Ionicons name="location" size={12} color={colors.brand} />
          <Text style={styles.brandTxt}>{user?.city}</Text>
        </View>
        {tier?.tier && (
          <Pressable testID="tier-badge" onPress={() => router.push("/points")} style={[styles.tierPill, { borderColor: tier.tier.color }]}>
            <Ionicons name={tier.tier.icon} size={14} color={tier.tier.color} />
            <Text style={{ color: tier.tier.color, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 }}>{tier.tier.name} Member</Text>
            {tier.tier.boost > 0 && <Text style={{ color: tier.tier.color, fontSize: 10 }}>+{Math.round(tier.tier.boost * 100)}% bonus</Text>}
          </Pressable>
        )}
        <Pressable onPress={() => router.push("/settings")} style={styles.modeChip} testID="appearance-quick">
          <Ionicons name={effectiveMode === "dark" ? "moon" : "sunny"} size={12} color={colors.textSubtle} />
          <Text style={styles.modeChipText}>{effectiveMode} theme</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: spacing.xl }}>
        {items.map((it) => (
          <Pressable key={it.id} testID={`menu-${it.id}`} onPress={it.onPress} style={styles.row}>
            <Ionicons name={it.icon as any} size={20} color={colors.brand} />
            <Text style={styles.lbl}>{it.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
        <Pressable testID="signout-btn" onPress={handleSignOut} style={[styles.row, { borderColor: colors.error + "55" }]}>
          <Ionicons name="log-out" size={20} color={colors.error} />
          <Text style={[styles.lbl, { color: colors.error }]}>Sign Out</Text>
          <View />
        </Pressable>
      </View>
    </ScrollView>
  );
}
