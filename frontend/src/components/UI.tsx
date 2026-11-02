import React from "react";
import { View, Text, Pressable, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useThemedStyles, touch, press, type, elevation } from "../theme";
import { useTheme } from "../context/ThemeContext";

export function GoldButton({ title, onPress, loading, disabled, testID, icon, style }:
  { title: string; onPress?: () => void; loading?: boolean; disabled?: boolean; testID?: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    gBtn: {
      backgroundColor: c.brand, borderRadius: radius.md, minHeight: 48, paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: c.brand2,
      shadowColor: c.brand, ...elevation.raised,
    },
    gBtnText: { color: c.onBrand, fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
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
    ghBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.md, minHeight: touch.minTarget, paddingVertical: 11, paddingHorizontal: 16, borderWidth: 1.5, borderColor: c.brand, backgroundColor: c.brandTint },
    ghBtnText: { color: c.brand2, fontSize: 14, fontWeight: "700" },
  }));
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.ghBtn, pressed && { opacity: press.opacity, transform: [{ scale: press.scale }] }, style]}>
      {icon ? <Ionicons name={icon as any} size={18} color={colors.brand} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.ghBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: any; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useThemedStyles((c) => ({
    card: {
      backgroundColor: c.surface2, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border,
      shadowColor: c.mode === "dark" ? "#D4AF37" : "#C4A35A", ...elevation.card,
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
    pill: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    pillText: { color: c.text, fontSize: 12, fontWeight: "500" },
  }));
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.pill, pressed && { opacity: press.opacity }, active && { backgroundColor: colors.brandTint, borderColor: colors.brand, borderWidth: 1.5 }]}>
      <Text style={[styles.pillText, active && { color: colors.brand2, fontWeight: "700" }]}>{label}</Text>
    </Pressable>
  );
}
export function Rating({ value, size = 14 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name="star" size={size} color={colors.brand} />
      <Text style={{ color: colors.text, fontSize: size, fontWeight: "500" }}>{value.toFixed(1)}</Text>
    </View>
  );
}
