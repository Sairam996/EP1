import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme";

export function GoldButton({ title, onPress, loading, disabled, testID, icon, style }:
  { title: string; onPress?: () => void; loading?: boolean; disabled?: boolean; testID?: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled || loading}
      style={[styles.gBtn, (disabled || loading) && { opacity: 0.6 }, style]}>
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
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.ghBtn, style]}>
      {icon ? <Ionicons name={icon as any} size={18} color={colors.brand} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.ghBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: any; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: any; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: any; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function Body({ children, style, muted }: { children: any; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.textMuted }, style]}>{children}</Text>;
}
export function Pill({ label, active, onPress, testID }:
  { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress}
      style={[styles.pill, active && { backgroundColor: colors.brandTint, borderColor: colors.brand }]}>
      <Text style={[styles.pillText, active && { color: colors.brand }]}>{label}</Text>
    </Pressable>
  );
}
export function Rating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name="star" size={size} color={colors.brand} />
      <Text style={{ color: colors.text, fontSize: size, fontWeight: "500" }}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gBtn: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  gBtnText: { color: colors.onBrand, fontSize: 16, fontWeight: "600", letterSpacing: 0.3 },
  ghBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.brand },
  ghBtnText: { color: colors.brand, fontSize: 15, fontWeight: "500" },
  card: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  h1: { color: colors.text, fontSize: 28, fontWeight: "500", letterSpacing: 0.3 },
  h2: { color: colors.text, fontSize: 20, fontWeight: "500" },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  pill: { paddingHorizontal: 14, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  pillText: { color: colors.textSubtle, fontSize: 13, fontWeight: "500" },
});
