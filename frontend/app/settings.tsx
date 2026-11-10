import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, type ThemeMode } from "@/src/context/ThemeContext";
import { TharaLogo } from "@/src/components/TharaLogo";
import { fonts, spacing, useThemedStyles } from "@/src/theme";

type Option = { key: ThemeMode; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap };
const OPTIONS: Option[] = [
  { key: "system", label: "Match system", hint: "Follows your device setting", icon: "phone-portrait-outline" },
  { key: "light", label: "Light", hint: "Warm ivory · gold accents", icon: "sunny-outline" },
  { key: "dark", label: "Dark", hint: "Midnight · gold accents", icon: "moon-outline" },
];

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { mode, setMode, colors, effectiveMode } = useTheme();
  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
    title: { color: c.text, fontSize: 22 + 4, fontFamily: fonts.displayBold, flex: 1 },
    section: { color: c.textMuted, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "600", marginTop: spacing.xl, marginBottom: 10, paddingHorizontal: spacing.xl },
    card: { marginHorizontal: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.lg, paddingVertical: 14 },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandTint, alignItems: "center", justifyContent: "center" },
    optionLabel: { color: c.text, fontSize: 15, fontWeight: "500" },
    optionHint: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    activeBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
    activeRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.border },
    previewCard: { marginTop: 10, marginHorizontal: spacing.xl, paddingVertical: spacing.xl, alignItems: "center" },
    previewSub: { color: c.textMuted, fontSize: 12, marginTop: 6, letterSpacing: 2 },
    back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    modeBadge: { paddingHorizontal: 0, paddingVertical: 4 },
    modeBadgeText: { color: c.brand, fontSize: 10, fontWeight: "600", letterSpacing: 1.4 },
    footerHint: { color: c.textMuted, fontSize: 11, textAlign: "center", paddingHorizontal: spacing.xxl, marginTop: 18, lineHeight: 16 },
  }));

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="settings-back">
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.previewCard} testID="theme-preview">
          <TharaLogo variant="wordmark" width={200} />
          <Text style={styles.previewSub}>CELEBRATE  ·  CURATED</Text>
          <View style={{ marginTop: 12 }}>
            <View style={styles.modeBadge}><Text style={styles.modeBadgeText}>{effectiveMode.toUpperCase()} MODE</Text></View>
          </View>
        </View>

        <Text style={styles.section}>Appearance</Text>
        <View style={styles.card}>
          {OPTIONS.map((opt, idx) => {
            const active = mode === opt.key;
            return (
              <Pressable
                key={opt.key}
                testID={`theme-${opt.key}`}
                onPress={() => setMode(opt.key)}
                style={[styles.row, idx > 0 && styles.rowDivider]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={opt.icon} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionHint}>{opt.hint}</Text>
                </View>
                {active ? (
                  <View style={styles.activeBadge}><Ionicons name="checkmark" size={14} color={colors.onBrand} /></View>
                ) : (
                  <View style={styles.activeRing} />
                )}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.footerHint}>
          Your preference is saved on this device and applied across the whole app instantly.
        </Text>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name="sparkles-outline" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionLabel}>Thara</Text>
              <Text style={styles.optionHint}>India&apos;s premium celebration marketplace</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>v1.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
