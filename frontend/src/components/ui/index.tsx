/**
 * Thara editorial primitives — open, borderless, luxury layout language.
 *
 *  - No bordered cards: separate content with whitespace, serif hierarchy,
 *    tracked gold eyebrows and gold hairlines (StyleSheet.hairlineWidth).
 *  - Lists are open rows (bare gold icon · title/subtitle · chevron).
 *  - Imagery is edge-to-edge / large rounded tiles with gradient + text on image.
 */
import React, { ReactNode } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, StyleProp, ViewStyle, TextStyle, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { fonts, press, spacing, useColors, type Palette } from "../../theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Gold hairline colour for the active palette (antique gold on ivory). */
export function hairlineColor(c: Palette, strength: "soft" | "strong" = "soft") {
  if (c.mode === "dark") return strength === "strong" ? "rgba(226,190,110,0.38)" : "rgba(226,190,110,0.18)";
  return strength === "strong" ? "rgba(140,106,38,0.42)" : "rgba(140,106,38,0.2)";
}
/** The metallic serif gold used for editorial accents. */
export function editorialGold(c: Palette) { return c.mode === "dark" ? "#E2BE6E" : "#8C6A26"; }

export const gutter = spacing.xl + 2; // 20 — editorial page margin

/** Thin gold hairline. `inset` indents from the page gutter (e.g. past a row icon). */
export function Divider({ inset = 0, vertical, strong, style }: { inset?: number; vertical?: boolean; strong?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const color = hairlineColor(c, strong ? "strong" : "soft");
  if (vertical) return <View style={[{ width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: color }, style]} />;
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: color, marginLeft: inset }, style]} />;
}

/** Small-caps, widely tracked gold label that introduces a section. */
export function EyebrowLabel({ children, style, muted }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  const c = useColors();
  return (
    <Text style={[{ color: muted ? c.textMuted : editorialGold(c), fontSize: 11, fontWeight: "600", letterSpacing: 2.4, textTransform: "uppercase" }, style]}>
      {children}
    </Text>
  );
}

/** Large serif heading. */
export function SerifTitle({ children, size = 26, style, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const c = useColors();
  return <Text numberOfLines={numberOfLines} style={[{ color: c.text, fontFamily: fonts.displayBold, fontSize: size, lineHeight: Math.round(size * 1.18), letterSpacing: 0.3 }, style]}>{children}</Text>;
}

/** Text-only action ("See all →"). The secondary action everywhere. */
export function TextLink({ title, onPress, icon, arrow, testID, style, color, size = 13, align }: {
  title: string; onPress?: () => void; icon?: IconName; arrow?: boolean; testID?: string;
  style?: StyleProp<ViewStyle>; color?: string; size?: number; align?: "center" | "flex-start" | "flex-end";
}) {
  const c = useColors();
  const col = color || editorialGold(c);
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={10} accessibilityRole="button"
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: align, minHeight: 32 }, pressed && { opacity: 0.6 }, style]}>
      {icon ? <Ionicons name={icon} size={size + 2} color={col} /> : null}
      <Text style={{ color: col, fontSize: size, fontWeight: "600", letterSpacing: 0.4 }}>{title}{arrow ? "  →" : ""}</Text>
    </Pressable>
  );
}

/** Header half of a Section — use above horizontally-scrolling (flush) content. */
export function SectionHeader({ eyebrow, title, action, onAction, style }: { eyebrow?: string; title?: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: gutter, marginTop: spacing.xxl + 6, marginBottom: spacing.md }, style]}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <EyebrowLabel>{eyebrow}</EyebrowLabel> : null}
        {title ? <SerifTitle size={24}>{title}</SerifTitle> : null}
      </View>
      {action && onAction ? <TextLink title={action} onPress={onAction} arrow /> : null}
    </View>
  );
}

/** Section: eyebrow (+ optional serif title and right action) above open content. */
export function Section({ eyebrow, title, action, onAction, children, style, flush, testID }: {
  eyebrow?: string; title?: string; action?: string; onAction?: () => void; children?: ReactNode;
  style?: StyleProp<ViewStyle>; flush?: boolean; testID?: string;
}) {
  return (
    <View testID={testID} style={[{ marginTop: spacing.xxl + 6 }, style]}>
      {(eyebrow || title || action) ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: gutter, marginBottom: spacing.md }}>
          <View style={{ flex: 1, gap: 4 }}>
            {eyebrow ? <EyebrowLabel>{eyebrow}</EyebrowLabel> : null}
            {title ? <SerifTitle size={24}>{title}</SerifTitle> : null}
          </View>
          {action && onAction ? <TextLink title={action} onPress={onAction} arrow /> : null}
        </View>
      ) : null}
      <View style={flush ? undefined : { paddingHorizontal: gutter }}>{children}</View>
    </View>
  );
}

/** Open list row: bare gold line icon · title/subtitle · trailing · chevron. Hairline below. */
export function ListRow({ icon, title, subtitle, trailing, soon, onPress, testID, last, chevron = true, destructive, iconColor, titleStyle }: {
  icon?: IconName; title: string; subtitle?: string; trailing?: ReactNode; soon?: boolean; onPress?: () => void;
  testID?: string; last?: boolean; chevron?: boolean; destructive?: boolean; iconColor?: string; titleStyle?: StyleProp<TextStyle>;
}) {
  const c = useColors();
  const gold = editorialGold(c);
  return (
    <View>
      <Pressable testID={testID} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 58, paddingVertical: 12 }, pressed && { opacity: 0.55 }]}>
        {icon ? <Ionicons name={icon} size={20} color={destructive ? c.error : iconColor || gold} style={{ width: 22, textAlign: "center" }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[{ color: destructive ? c.error : c.text, fontSize: 16, fontWeight: "500", letterSpacing: 0.1 }, titleStyle]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={{ color: c.textMuted, fontSize: 12.5, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {soon ? <Text style={{ color: gold, opacity: 0.75, fontSize: 12, fontStyle: "italic", fontFamily: fonts.display }}>soon</Text> : null}
        {trailing}
        {chevron && onPress ? <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ opacity: 0.6 }} /> : null}
      </Pressable>
      {last ? null : <Divider inset={icon ? 38 : 0} />}
    </View>
  );
}

export type Stat = { id: string; value?: string | number | null; label: string; icon?: IconName; onPress?: () => void };
/** Borderless stats strip — serif numbers over tracked labels, split by vertical hairlines. */
export function StatStrip({ items, style }: { items: Stat[]; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const gold = editorialGold(c);
  return (
    <View style={[{ flexDirection: "row", alignItems: "stretch", paddingVertical: spacing.md }, style]}>
      {items.map((it, i) => (
        <React.Fragment key={it.id}>
          {i > 0 ? <Divider vertical strong style={{ marginVertical: 8 }} /> : null}
          <Pressable testID={it.id} onPress={it.onPress} disabled={!it.onPress} accessibilityRole="button" accessibilityLabel={`${it.value ?? ""} ${it.label}`}
            style={({ pressed }) => [{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, gap: 4 }, pressed && { opacity: 0.55 }]}>
            {it.value !== undefined && it.value !== null
              ? <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 32 }}>{it.value}</Text>
              : it.icon ? <Ionicons name={it.icon} size={22} color={gold} style={{ height: 32, lineHeight: 32 }} /> : null}
            <Text style={{ color: c.textMuted, fontSize: 10.5, fontWeight: "600", letterSpacing: 1.8, textTransform: "uppercase" }}>{it.label}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

/** Large rounded image tile, no border; gradient scrim with text on the image. */
export function ImageTile({ uri, title, subtitle, eyebrow, width, height = 220, radius = 18, onPress, testID, topRight, bottomRight, style, fallbackIcon = "images-outline" }: {
  uri?: string | null; title?: string; subtitle?: string; eyebrow?: string; width?: number | `${number}%`; height?: number; radius?: number;
  onPress?: () => void; testID?: string; topRight?: ReactNode; bottomRight?: ReactNode; style?: StyleProp<ViewStyle>; fallbackIcon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: c.surface3 }, pressed && { opacity: press.opacity, transform: [{ scale: 0.985 }] }, style]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}><Ionicons name={fallbackIcon} size={30} color={editorialGold(c)} style={{ opacity: 0.5 }} /></View>}
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.78)"]} locations={[0.35, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {topRight ? <View style={{ position: "absolute", top: 12, right: 12 }}>{topRight}</View> : null}
      <View style={{ position: "absolute", left: 16, right: 16, bottom: 14, flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={{ color: "#E2BE6E", fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }} numberOfLines={1}>{eyebrow}</Text> : null}
          {title ? <Text style={{ color: "#FFF8EB", fontFamily: fonts.displayBold, fontSize: height > 180 ? 24 : 18, lineHeight: height > 180 ? 28 : 22 }} numberOfLines={2}>{title}</Text> : null}
          {subtitle ? <Text style={{ color: "rgba(255,248,235,0.82)", fontSize: 12, marginTop: 3 }} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {bottomRight}
      </View>
    </Pressable>
  );
}

/** Text tabs with a gold underline on the active one (replaces boxed chips). */
export function UnderlineTabs<T extends string>({ items, value, onChange, testIDPrefix, style, scroll = true }: {
  items: { key: T; label: string }[]; value: T; onChange: (k: T) => void; testIDPrefix?: string; style?: StyleProp<ViewStyle>; scroll?: boolean;
}) {
  const c = useColors();
  const gold = editorialGold(c);
  const body = items.map((it) => {
    const on = it.key === value;
    return (
      <Pressable key={it.key} testID={testIDPrefix ? `${testIDPrefix}-${it.key}` : undefined} onPress={() => onChange(it.key)} hitSlop={6}
        accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ paddingVertical: 10, marginRight: 22 }}>
        <Text style={{ color: on ? c.text : c.textMuted, fontSize: 14, fontWeight: on ? "700" : "500", letterSpacing: 0.3 }}>{it.label}</Text>
        <View style={{ height: 2, marginTop: 6, borderRadius: 1, backgroundColor: on ? gold : "transparent" }} />
      </Pressable>
    );
  });
  if (!scroll) return <View style={[{ flexDirection: "row", paddingHorizontal: gutter }, style]}>{body}</View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter }} style={style}>{body}</ScrollView>;
}

/** Key/value line for summaries (booking, checkout) — open, hairline-separated. */
export function KeyValue({ label, value, last, emphasis, valueColor }: { label: string; value: ReactNode; last?: boolean; emphasis?: boolean; valueColor?: string }) {
  const c = useColors();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, gap: 12 }}>
        <Text style={{ color: emphasis ? c.text : c.textMuted, fontSize: emphasis ? 15 : 13.5, fontWeight: emphasis ? "700" : "400" }}>{label}</Text>
        {typeof value === "string" || typeof value === "number"
          ? <Text style={{ color: valueColor || c.text, fontSize: emphasis ? 22 : 14, fontFamily: emphasis ? fonts.displayBold : undefined, fontWeight: emphasis ? undefined : "600", flexShrink: 1, textAlign: "right" }}>{value}</Text>
          : value}
      </View>
      {last ? null : <Divider />}
    </View>
  );
}

/** Soft radial-ish gold glow behind a hero element (stacked translucent discs). */
export function GoldGlow({ size = 220, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const base = c.mode === "dark" ? "226,190,110" : "176,138,62";
  const layers = [1, 0.78, 0.56, 0.36];
  const alphas = c.mode === "dark" ? [0.035, 0.05, 0.065, 0.08] : [0.05, 0.07, 0.09, 0.11];
  return (
    <View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      {layers.map((f, i) => (
        <View key={i} style={{ position: "absolute", width: size * f, height: size * f, borderRadius: (size * f) / 2, backgroundColor: `rgba(${base},${alphas[i]})` }} />
      ))}
    </View>
  );
}

/** Editorial band: gradient wash, serif headline, text link. Borderless. */
export function FeatureBand({ eyebrow, title, subtitle, cta, onPress, icon, testID, style }: {
  eyebrow?: string; title: string; subtitle?: string; cta: string; onPress?: () => void; icon?: IconName; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const gold = editorialGold(c);
  const colors = c.mode === "dark"
    ? (["rgba(226,190,110,0.16)", "rgba(226,190,110,0.04)", "rgba(0,0,0,0)"] as const)
    : (["rgba(176,138,62,0.20)", "rgba(176,138,62,0.07)", "rgba(251,246,236,0)"] as const);
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [{ marginTop: spacing.xxl }, pressed && { opacity: 0.85 }, style]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ paddingHorizontal: gutter, paddingVertical: 22 }}>
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, backgroundColor: gold, opacity: 0.85 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ flex: 1 }}>
            {eyebrow ? <EyebrowLabel style={{ marginBottom: 6 }}>{eyebrow}</EyebrowLabel> : null}
            <Text style={{ color: c.text, fontFamily: fonts.displayBold, fontSize: 25, lineHeight: 29 }}>{title}</Text>
            {subtitle ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{subtitle}</Text> : null}
            <Text style={{ color: gold, fontSize: 13, fontWeight: "700", letterSpacing: 0.6, marginTop: 12 }}>{cta}  →</Text>
          </View>
          {icon ? <Ionicons name={icon} size={40} color={gold} style={{ opacity: 0.55 }} /> : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** Loading line used inside open sections. */
export function InlineLoader() {
  const c = useColors();
  return <View style={{ paddingVertical: 28, alignItems: "center" }}><ActivityIndicator color={editorialGold(c)} /></View>;
}

/** Small status word (gold/green/red text with a dot) — replaces bordered status pills. */
export function StatusText({ status, color }: { status: string; color?: string }) {
  const c = useColors();
  const s = String(status || "").toLowerCase();
  const col = color || (s.includes("cancel") || s.includes("reject") || s.includes("fail") ? c.error
    : s.includes("confirm") || s.includes("paid") || s.includes("complete") || s.includes("approved") || s.includes("accept") ? c.success
    : editorialGold(c));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
      <Text style={{ color: col, fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" }}>{String(status || "").replace(/_/g, " ")}</Text>
    </View>
  );
}
