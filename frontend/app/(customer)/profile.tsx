import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [tier, setTier] = useState<any>(null);
  useEffect(() => { if (user?.role === "customer") api.get("/me/tier").then(setTier).catch(() => {}); }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const items = [
    { id: "ref", icon: "gift", label: "Refer & Earn — 200 pts per friend", onPress: () => router.push("/referrals") },
    { id: "pts", icon: "diamond", label: "EventPro Points", onPress: () => router.push("/points") },
    { id: "fav", icon: "heart", label: "Favorites", onPress: () => router.push("/favorites") },
    { id: "ai", icon: "sparkles", label: "Ask AI Assistant", onPress: () => router.push("/ai-chat") },
    { id: "help", icon: "help-circle", label: "Help & Support", onPress: () => {} },
    { id: "terms", icon: "document-text", label: "Terms & Privacy", onPress: () => {} },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Image source={{ uri: user?.avatar }} style={styles.avatar} contentFit="cover" />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}>
          <Ionicons name="location" size={12} color={colors.brand} />
          <Text style={{ color: colors.brand, fontSize: 12 }}>{user?.city}</Text>
        </View>
        {tier?.tier && (
          <Pressable testID="tier-badge" onPress={() => router.push("/points")} style={[styles.tierPill, { borderColor: tier.tier.color }]}>
            <Ionicons name={tier.tier.icon} size={14} color={tier.tier.color} />
            <Text style={{ color: tier.tier.color, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 }}>{tier.tier.name} Member</Text>
            {tier.tier.boost > 0 && <Text style={{ color: tier.tier.color, fontSize: 10 }}>+{Math.round(tier.tier.boost * 100)}% bonus</Text>}
          </Pressable>
        )}
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: spacing.lg }}>
        {items.map(it => (
          <Pressable key={it.id} testID={`menu-${it.id}`} onPress={it.onPress} style={styles.row}>
            <Ionicons name={it.icon as any} size={20} color={colors.brand} />
            <Text style={styles.lbl}>{it.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
        <Pressable testID="signout-btn" onPress={handleSignOut} style={[styles.row, { borderColor: colors.error + "33" }]}>
          <Ionicons name="log-out" size={20} color={colors.error} />
          <Text style={[styles.lbl, { color: colors.error }]}>Sign Out</Text>
          <View />
        </Pressable>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  header: { alignItems: "center", paddingHorizontal: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: colors.brand },
  name: { color: colors.text, fontSize: 22, fontWeight: "500", marginTop: spacing.md },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brand },
  tierPill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, backgroundColor: colors.surface2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  lbl: { color: colors.text, fontSize: 15, fontWeight: "500", flex: 1 },
});
