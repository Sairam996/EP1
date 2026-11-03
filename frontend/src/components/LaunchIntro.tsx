/**
 * Cold-start launch: Thara wordmark image fades in, then fades out while
 * children (login) slide up from the bottom. Theme-aware gold/black or N3 light.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { TharaLogo } from "./TharaLogo";

const LETTERS = ["T", "H", "A", "R", "A"] as const;
const { height: SCREEN_H } = Dimensions.get("window");

type Props = {
  /** When false, skip animation and show children immediately. */
  play: boolean;
  children: React.ReactNode;
  testID?: string;
};

export function LaunchIntro({ play, children, testID }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState(!play);

  const letterOpacities = useRef(LETTERS.map(() => new Animated.Value(play ? 0 : 1))).current;
  const letterYs = useRef(LETTERS.map(() => new Animated.Value(play ? 10 : 0))).current;
  const titleY = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(play ? SCREEN_H * 0.55 : 0)).current;
  const contentOpacity = useRef(new Animated.Value(play ? 0 : 1)).current;
  const scrimOpacity = useRef(new Animated.Value(1)).current;

  const topRest = useMemo(() => {
    // Move from vertical center toward the brand slot under the status bar.
    const centerY = 0;
    const targetY = -(SCREEN_H * 0.5 - (insets.top + 72));
    return { centerY, targetY };
  }, [insets.top]);

  useEffect(() => {
    if (!play) {
      setDone(true);
      return;
    }

    const letterAnims = LETTERS.map((_, i) =>
      Animated.parallel([
        Animated.timing(letterOpacities[i], {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(letterYs[i], {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.sequence([
      Animated.stagger(150, letterAnims),
      Animated.delay(420),
      Animated.parallel([
        Animated.timing(titleY, {
          toValue: topRest.targetY,
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleScale, {
          toValue: 0.72,
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentY, {
          toValue: 0,
          duration: 820,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 640,
          delay: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) setDone(true);
    });
  }, [play, topRest.targetY, letterOpacities, letterYs, titleY, titleScale, contentY, contentOpacity, scrimOpacity]);


  return (
    <View testID={testID ?? "launch-intro"} style={[styles.root, { backgroundColor: colors.surface }]}>
      {/* Soft brand wash behind letters */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: scrimOpacity,
            backgroundColor: colors.surface,
          },
        ]}
      />

      {/* Centered → rising THARA */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.titleWrap,
          {
            transform: [{ translateY: titleY }, { scale: titleScale }],
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: Animated.multiply(letterOpacities[LETTERS.length - 1], scrimOpacity),
            transform: [{ translateY: letterYs[0] }],
          }}
        >
          <TharaLogo variant="wordmark" width={280} />
        </Animated.View>
      </Animated.View>

      {/* Login / destination content rising from bottom */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentY }],
          },
        ]}
        pointerEvents={done ? "auto" : "none"}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  titleWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  letter: {
    fontSize: 52,
    fontWeight: "600",
    letterSpacing: 6,
    fontFamily: "System",
  },
  content: { flex: 1, zIndex: 1 },
});
