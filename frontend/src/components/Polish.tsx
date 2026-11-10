import { ReactNode } from "react";
import { View, Text, Pressable, StyleProp, ViewStyle, PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GoldButton, GhostButton } from "@/src/components/UI";
import { fonts, press, spacing, type, useThemedStyles, useColors } from "@/src/theme";
import { GoldGlow, editorialGold } from "@/src/components/ui";

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
    medal: { width: compact ? 56 : 76, height: compact ? 56 : 76, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
    title: { color: p.text, fontFamily: fonts.displayBold, fontSize: compact ? 20 : 24, lineHeight: compact ? 24 : 29, textAlign: "center" },
    msg: { ...type.body, color: p.textMuted, textAlign: "center", maxWidth: 300 },
  }));
  return (
    <View style={s.wrap} testID={testID}>
      <View style={s.medal}><GoldGlow size={compact ? 90 : 120} /><Ionicons name={icon} size={compact ? 26 : 32} color={editorialGold(c)} /></View>
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
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingVertical: 6 }}>
      <Ionicons name={icon} size={13} color={c.textMuted} />
      <Text style={{ ...type.caption, color: c.textMuted, fontStyle: "italic" }}>{label}</Text>
    </View>
  );
}

/** Section heading: serif title with a short gold rule (icon kept for API compat, rendered subtly). */
export function SectionTitle({ icon, title, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: spacing.md, marginTop: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26, flex: 1 }}>{title}</Text>
        {right}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <View style={{ width: 28, height: 1, backgroundColor: editorialGold(c) }} />
        <Ionicons name={icon} size={11} color={editorialGold(c)} style={{ opacity: 0.8 }} />
      </View>
    </View>
  );
}
