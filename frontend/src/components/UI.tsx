import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useThemedStyles, touch, press, type } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { numeric } from "@/src/components/Num";

export function GoldButton({ title, onPress, loading, disabled, testID, icon, style }:
  { title: string; onPress?: () => void; loading?: boolean; disabled?: boolean; testID?: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    gBtn: {
      backgroundColor: c.brand, borderRadius: radius.pill, minHeight: 50, paddingVertical: 13, paddingHorizontal: 22, alignItems: "center", justifyContent: "center",
      shadowColor: c.brand, shadowOpacity: c.mode === "dark" ? 0.28 : 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    },
    gBtnText: { color: c.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", ...numeric },
  }));
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading}
      accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [styles.gBtn, pressed && { opacity: press.opacity, transform: [{ scale: press.scale }] }, (disabled || loading) && { opacity: press.disabledOpacity }, style]}>
      {loading ? <ActivityIndicator color={colors.onBrand} /> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Ionicons name={icon as any} size={18} color={colors.onBrand} /> : null}
          <Text style={styles.gBtnText}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function GhostButton({ title, onPress, testID, icon, style }:
  { title: string; onPress?: () => void; testID?: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    // Secondary action = text button (no outline, no fill) per the editorial layout.
    ghBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", minHeight: touch.minTarget, paddingVertical: 10, paddingHorizontal: 12 },
    ghBtnText: { color: c.mode === "dark" ? "#E2BE6E" : "#8C6A26", fontSize: 14, fontWeight: "700", letterSpacing: 0.6 },
  }));
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.ghBtn, pressed && { opacity: 0.55 }, style]}>
      {icon ? <Ionicons name={icon as any} size={18} color={colors.mode === "dark" ? "#E2BE6E" : "#8C6A26"} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.ghBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: any; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useThemedStyles((c) => ({
    // Open block: no border, no fill — separation comes from a gold hairline below.
    card: {
      paddingVertical: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)",
    },
  }));
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: any; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles((c) => ({ h1: { color: c.text, ...type.h1 } }));
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: any; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles((c) => ({ h2: { color: c.text, ...type.h2 } }));
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function Body({ children, style, muted }: { children: any; style?: StyleProp<TextStyle>; muted?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({ body: { color: c.text, ...type.body } }));
  return <Text style={[styles.body, muted && { color: colors.textMuted }, style]}>{children}</Text>;
}
export function Pill({ label, active, onPress, testID }:
  { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    // Text option with an underline when selected (no boxed chip).
    pill: { paddingHorizontal: 4, minHeight: 36, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
    pillText: { color: c.textMuted, fontSize: 14, fontWeight: "500" },
  }));
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.pill, pressed && { opacity: press.opacity }, active && { borderBottomColor: colors.mode === "dark" ? "#E2BE6E" : "#8C6A26" }]}>
      <Text style={[styles.pillText, active && { color: colors.text, fontWeight: "700" }]}>{label}</Text>
    </Pressable>
  );
}
export function Rating({ value, size = 14 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name="star" size={size} color={colors.brand} />
      <Text style={{ color: colors.text, fontSize: size, fontWeight: "500", ...numeric }}>{value.toFixed(1)}</Text>
    </View>
  );
}
