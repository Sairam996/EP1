import { ReactNode } from "react";
import { View, Text, Pressable, StyleProp, ViewStyle, PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GoldButton, GhostButton } from "@/src/components/UI";
import { press, radius, spacing, type, useThemedStyles, useColors } from "@/src/theme";

/** Pressable with subtle opacity + scale feedback from theme.press tokens. */
export function PressableScale({ style, children, ...rest }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: press.opacity, transform: [{ scale: press.scale }] }]}>
      {children}
    </Pressable>
  );
}

/** Calm empty / sparse state: icon medallion + title + copy + optional CTA. */
export function EmptyState({ icon, title, message, ctaTitle, onCta, ghost, compact, testID }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; message?: string;
  ctaTitle?: string; onCta?: () => void; ghost?: boolean; compact?: boolean; testID?: string;
}) {
  const c = useColors();
  const s = useThemedStyles((p) => ({
    wrap: { alignItems: "center", paddingVertical: compact ? spacing.xl : spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
    medal: { width: compact ? 52 : 68, height: compact ? 52 : 68, borderRadius: radius.pill, backgroundColor: p.brandTint, borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
    title: { ...type.h2, color: p.text, textAlign: "center" },
    msg: { ...type.body, color: p.textMuted, textAlign: "center", maxWidth: 300 },
  }));
  return (
    <View style={s.wrap} testID={testID}>
      <View style={s.medal}><Ionicons name={icon} size={compact ? 22 : 28} color={c.brand} /></View>
      <Text style={s.title}>{title}</Text>
      {message ? <Text style={s.msg}>{message}</Text> : null}
      {ctaTitle && onCta ? (
        <View style={{ marginTop: spacing.md, alignSelf: "stretch", paddingHorizontal: spacing.xxl }}>
          {ghost ? <GhostButton title={ctaTitle} onPress={onCta} /> : <GoldButton title={ctaTitle} onPress={onCta} />}
        </View>
      ) : null}
    </View>
  );
}

/** Small muted chip for "not listed yet" states. */
export function SoftChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface3 }}>
      <Ionicons name={icon} size={13} color={c.textMuted} />
      <Text style={{ ...type.caption, color: c.textMuted }}>{label}</Text>
    </View>
  );
}

/** Section heading with gold icon. */
export function SectionTitle({ icon, title, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.md }}>
      <Ionicons name={icon} size={16} color={c.brand} />
      <Text style={{ ...type.h2, color: c.text, flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}
