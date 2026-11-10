import React from "react";
import { Pressable, Text, View, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { fonts, useThemedStyles } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";
import { editorialGold } from "@/src/components/ui";

const AnimPress = Animated.createAnimatedComponent(Pressable);

/** Text tab (icon + label, no box) with an animated gold underline when active. */
export function AnimatedChip({ label, icon, active, onPress, testID, style }:
  { label: string; icon?: string; active?: boolean; onPress?: () => void; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const gold = editorialGold(colors);
  const styles = useThemedStyles((c) => ({
    chip: { paddingTop: 8, paddingBottom: 4, marginRight: 14, flexShrink: 0 },
    row: { flexDirection: "row", alignItems: "center" },
    chipText: { color: c.textMuted, fontSize: 14, fontWeight: "500", letterSpacing: 0.2 },
    line: { height: 2, borderRadius: 1, marginTop: 7 },
  }));
  const scale = useSharedValue(1);
  const on = useSharedValue(active ? 1 : 0);
  React.useEffect(() => { on.value = withTiming(active ? 1 : 0, { duration: 240 }); }, [active, on]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scaleX: 0.3 + on.value * 0.7 }] }));
  return (
    <AnimPress testID={testID} onPressIn={() => { scale.value = withSpring(0.95, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 180 }); }}
      onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: !!active }}
      style={[styles.chip, pressStyle, style]}>
      <View style={styles.row}>
        {icon ? <Ionicons name={icon as any} size={15} color={active ? gold : colors.textMuted} style={{ marginRight: 6 }} /> : null}
        <Text style={[styles.chipText, active && { color: colors.text, fontWeight: "700" }]}>{label}</Text>
      </View>
      <Animated.View style={[styles.line, { backgroundColor: gold }, lineStyle]} />
    </AnimPress>
  );
}

/** Event-type item: bare gold line icon over a serif label — no tile, soft glow when active. */
export function AnimatedEventTile({ label, icon, active, onPress, testID }:
  { label: string; icon: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const gold = editorialGold(colors);
  const styles = useThemedStyles((c) => ({
    tile: { alignItems: "center", width: 78 },
    iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
    tileLbl: { color: c.text, fontFamily: fonts.display, fontSize: 15, marginTop: 4, textAlign: "center" },
  }));
  const scale = useSharedValue(1);
  const ring = useSharedValue(active ? 1 : 0);
  React.useEffect(() => { ring.value = withTiming(active ? 1 : 0, { duration: 250 }); }, [active, ring]);
  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + ring.value * 0.65 }));
  return (
    <AnimPress testID={testID} onPressIn={() => { scale.value = withSpring(0.92); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 9, stiffness: 200 }); }}
      onPress={onPress} style={[styles.tile, wrapStyle]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.iconWrap}>
        <Animated.View style={[{ position: "absolute", width: 56, height: 56, borderRadius: 28, backgroundColor: colors.mode === "dark" ? "rgba(226,190,110,0.09)" : "rgba(176,138,62,0.10)" }, glowStyle]} />
        <Ionicons name={(icon?.endsWith("-outline") ? icon : `${icon}-outline`) as any} size={26} color={gold} />
      </View>
      <Text style={[styles.tileLbl, active && { color: gold }]} numberOfLines={1}>{label}</Text>
    </AnimPress>
  );
}
