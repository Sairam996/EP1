/**
 * Translucent rotating search hints ("Search 'wedding photographers'" …).
 * Soft fade + slide every ~2.5s on the UI thread (reanimated). Pauses when
 * `paused` (user is typing) and shows a static hint when Reduce Motion is on.
 * pointerEvents="none" so taps fall through to the field / pressable below.
 */
import React, { useEffect, useState } from "react";
import { StyleProp, TextStyle, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "@/src/context/ThemeContext";
import { useReduceMotion } from "@/src/components/Celebration";

export const SEARCH_HINTS = [
  "wedding photographers",
  "sangeet decor",
  "birthday caterers in Hyderabad",
  "mehendi artists",
  "DJ for corporate party",
  "banquet halls for 300 guests",
];

export function RotatingHint({ paused, prefix = "Search", hints = SEARCH_HINTS, style, interval = 2500, testID }:
  { paused?: boolean; prefix?: string; hints?: string[]; style?: StyleProp<TextStyle>; interval?: number; testID?: string }) {
  const { isDark } = useTheme();
  const reduce = useReduceMotion();
  const [i, setI] = useState(0);
  const o = useSharedValue(1);
  const y = useSharedValue(0);

  useEffect(() => {
    if (paused || reduce) return;
    const advance = () => {
      setI((n) => (n + 1) % hints.length);
      y.set(8);
      o.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
      y.set(withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));
    };
    const t = setInterval(() => {
      // Fade/slide the current hint up and out, then swap in the next one.
      y.set(withTiming(-8, { duration: 260, easing: Easing.in(Easing.cubic) }));
      o.set(withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }, (done) => { if (done) runOnJS(advance)(); }));
    }, interval);
    return () => clearInterval(t);
  }, [paused, reduce, hints.length, interval, o, y]);

  // Reset to fully visible whenever rotation stops.
  useEffect(() => { if (paused || reduce) { o.set(1); y.set(0); } }, [paused, reduce, o, y]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  const color = isDark ? "rgba(255,248,235,0.42)" : "rgba(28,28,28,0.38)";
  return (
    <View pointerEvents="none" style={{ flex: 1, justifyContent: "center", overflow: "hidden" }}>
      <Animated.Text testID={testID} numberOfLines={1} style={[{ color, fontSize: 15 }, style, anim]}>
        {prefix} ‘{hints[reduce ? 0 : i]}’
      </Animated.Text>
    </View>
  );
}
