import React from "react";
import { View, Text, Pressable, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useThemedStyles } from "../theme";
import { useTheme } from "../context/ThemeContext";

export function GoldButton({ title, onPress, loading, disabled, testID, icon, style }:
  { title: string; onPress?: () => void; loading?: boolean; disabled?: boolean; testID?: string; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    gBtn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
    gBtnText: { color: c.onBrand, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 },
  }));
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
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    ghBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: c.brand },
    ghBtnText: { color: c.brand, fontSize: 14, fontWeight: "500" },
  }));
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.ghBtn, style]}>
      {icon ? <Ionicons name={icon as any} size={18} color={colors.brand} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.ghBtnText}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: any; style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useThemedStyles((c) => ({
    card: { backgroundColor: c.surface2, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  }));
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: any; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles((c) => ({ h1: { color: c.text, fontSize: 22, fontWeight: "500", letterSpacing: 0.3 } }));
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: any; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles((c) => ({ h2: { color: c.text, fontSize: 17, fontWeight: "500" } }));
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function Body({ children, style, muted }: { children: any; style?: StyleProp<TextStyle>; muted?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({ body: { color: c.text, fontSize: 13, lineHeight: 19 } }));
  return <Text style={[styles.body, muted && { color: colors.textMuted }, style]}>{children}</Text>;
}
export function Pill({ label, active, onPress, testID }:
  { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    pill: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    pillText: { color: c.textSubtle, fontSize: 12, fontWeight: "500" },
  }));
  return (
    <Pressable testID={testID} onPress={onPress}
      style={[styles.pill, active && { backgroundColor: colors.brandTint, borderColor: colors.brand }]}>
      <Text style={[styles.pillText, active && { color: colors.brand }]}>{label}</Text>
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
