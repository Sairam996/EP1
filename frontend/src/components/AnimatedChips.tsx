import React from "react";
import { Pressable, Text, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";
import { radius, useThemedStyles } from "@/src/theme";
import { useTheme } from "@/src/context/ThemeContext";

const AnimPress = Animated.createAnimatedComponent(Pressable);

/** Animated chip that springs on press and glows when active. */
export function AnimatedChip({ label, icon, active, onPress, testID, style }:
  { label: string; icon?: string; active?: boolean; onPress?: () => void; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    chip: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 38, borderRadius: radius.pill,
      borderWidth: 1, flexShrink: 0,
      shadowColor: c.brand, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    },
    chipText: { color: c.textSubtle, fontSize: 13, fontWeight: "500" },
  }));
  const scale = useSharedValue(1);
  const glow = useSharedValue(active ? 1 : 0);
  React.useEffect(() => { glow.value = withTiming(active ? 1 : 0, { duration: 220 }); }, [active]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: active ? colors.brand : colors.border,
    backgroundColor: active ? colors.brandTint : colors.surface2,
    shadowOpacity: glow.value * 0.5,
  }));
  return (
    <AnimPress testID={testID} onPressIn={() => { scale.value = withSpring(0.94, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 180 }); }}
      onPress={onPress}
      style={[styles.chip, animStyle, style]}>
      {icon ? <Ionicons name={icon as any} size={14} color={active ? colors.brand : colors.textMuted} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.chipText, active && { color: colors.brand, fontWeight: "600" }]}>{label}</Text>
    </AnimPress>
  );
}

/** Larger animated event-type tile with bouncy press + active glow. */
export function AnimatedEventTile({ label, icon, active, onPress, testID }:
  { label: string; icon: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => ({
    tile: { alignItems: "center", width: 80 },
    tileIcon: {
      width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center",
      borderWidth: 1,
      shadowColor: c.brand, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    },
    tileLbl: { color: c.textSubtle, fontSize: 12, marginTop: 7, textAlign: "center" },
  }));
  const scale = useSharedValue(1);
  const ring = useSharedValue(active ? 1 : 0);
  React.useEffect(() => { ring.value = withTiming(active ? 1 : 0, { duration: 250 }); }, [active]);
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    backgroundColor: active ? colors.brand : colors.surface2,
    borderColor: active ? colors.brand : colors.border,
    shadowOpacity: ring.value * 0.6,
  }));
  return (
    <AnimPress testID={testID} onPressIn={() => { scale.value = withSpring(0.92); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 9, stiffness: 200 }); }}
      onPress={onPress} style={[styles.tile, wrapStyle]}>
      <Animated.View style={[styles.tileIcon, iconStyle]}>
        <Ionicons name={icon as any} size={26} color={active ? colors.onBrand : colors.brand} />
      </Animated.View>
      <Text style={[styles.tileLbl, active && { color: colors.brand, fontWeight: "600" }]} numberOfLines={1}>{label}</Text>
    </AnimPress>
  );
}
