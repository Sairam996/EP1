/**
 * Thara celebrations — gold/ivory confetti, success seal and heart pop.
 *
 * Pure JS + react-native-reanimated (bundled in Expo Go), no custom native code.
 * One shared progress value drives every confetti piece on the UI thread, so a
 * 120-piece burst stays smooth. Everything is pointerEvents="none" and
 * auto-dismisses. Respects the OS "Reduce Motion" setting (no confetti; a
 * simple fade instead).
 */
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts } from "@/src/theme";

/* ─────────────────────────── palettes ─────────────────────────── */

const GOLD_DARK = ["#E2BE6E", "#D9B25F", "#F3E3B5", "#FBF6EC", "#B08A3E", "#FFF1CC", "#C9A04A"];
const GOLD_LIGHT = ["#8C6A26", "#B08A3E", "#D9B25F", "#E2BE6E", "#6E531C", "#C9A04A", "#A27C34"];

export function useConfettiColors() {
  const { isDark } = useTheme();
  return isDark ? GOLD_DARK : GOLD_LIGHT;
}

/* ─────────────────────────── reduce motion ─────────────────────────── */

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduce(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

export function hapticSuccess() {
  if (Platform.OS === "web") return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
export function hapticLight() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/* ─────────────────────────── confetti ─────────────────────────── */

export type Intensity = "big" | "light";

type Piece = {
  x0: number; y0: number; vx: number; vy: number; g: number; drag: number;
  w: number; h: number; r: number; color: string;
  rot0: number; spin: number; flip: number; sway: number; swayF: number; phase: number;
  delay: number;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makePieces(intensity: Intensity, W: number, H: number, palette: string[]): Piece[] {
  const pieces: Piece[] = [];
  const shape = () => {
    const k = Math.random();
    if (k < 0.45) return { w: rand(6, 9), h: rand(11, 16), r: 1.5 };      // ribbon card
    if (k < 0.7) return { w: rand(6, 8), h: rand(6, 8), r: 1 };           // square
    if (k < 0.88) return { w: rand(5, 8), h: 0, r: 99 };                  // dot (h = w)
    return { w: rand(3, 4), h: rand(16, 22), r: 2 };                      // streamer
  };
  const push = (p: Omit<Piece, "w" | "h" | "r" | "color" | "rot0" | "spin" | "flip" | "sway" | "swayF" | "phase">) => {
    const s = shape();
    pieces.push({
      ...p, w: s.w, h: s.h || s.w, r: s.r,
      color: palette[Math.floor(Math.random() * palette.length)],
      rot0: rand(0, 360), spin: rand(-540, 540), flip: rand(4, 11),
      sway: rand(6, 22), swayF: rand(2, 5), phase: rand(0, Math.PI * 2),
    });
  };

  if (intensity === "big") {
    // Two cannons from the lower corners, angled up and inwards…
    for (let i = 0; i < 40; i++) {
      push({ x0: -10, y0: H * 0.78, vx: rand(260, 620), vy: rand(-1150, -720), g: rand(900, 1150), drag: rand(0.8, 1.4), delay: rand(0, 0.12) });
      push({ x0: W + 10, y0: H * 0.78, vx: -rand(260, 620), vy: rand(-1150, -720), g: rand(900, 1150), drag: rand(0.8, 1.4), delay: rand(0, 0.12) });
    }
    // …plus a soft champagne shower from the top.
    for (let i = 0; i < 36; i++) {
      push({ x0: rand(0, W), y0: rand(-60, -10), vx: rand(-40, 40), vy: rand(60, 220), g: rand(160, 280), drag: 0.6, delay: rand(0.15, 0.7) });
    }
  } else {
    // Gentle burst from upper centre.
    for (let i = 0; i < 64; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = rand(260, 640);
      push({ x0: W / 2, y0: H * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: rand(650, 900), drag: rand(1.2, 2), delay: rand(0, 0.08) });
    }
  }
  return pieces;
}

const DURATION = 2800;

function ConfettiPiece({ p, progress }: { p: Piece; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const total = DURATION / 1000;
    const t = Math.max(0, progress.value * total - p.delay);
    const k = p.drag;
    const ex = (1 - Math.exp(-k * t)) / k;
    const x = p.x0 + p.vx * ex + Math.sin(t * p.swayF + p.phase) * p.sway * Math.min(1, t * 2);
    const y = p.y0 + p.vy * ex + 0.5 * p.g * t * t;
    const life = t / (total - p.delay);
    const opacity = t <= 0 ? 0 : life > 0.72 ? Math.max(0, 1 - (life - 0.72) / 0.28) : 1;
    return {
      opacity,
      transform: [
        { translateX: x - p.w / 2 },
        { translateY: y - p.h / 2 },
        { rotate: `${p.rot0 + p.spin * t}deg` },
        { scaleY: Math.cos(t * p.flip + p.phase) },
      ],
    };
  });
  return (
    <Animated.View
      style={[{ position: "absolute", left: 0, top: 0, width: p.w, height: p.h, borderRadius: p.r, backgroundColor: p.color }, style]}
    />
  );
}

/** Full-screen confetti burst. Change `burstKey` to fire again. Never blocks touches. */
export function Confetti({ burstKey, intensity = "big", onDone }: { burstKey: number | string; intensity?: Intensity; onDone?: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const palette = useConfettiColors();
  const progress = useSharedValue(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pieces = useMemo(() => makePieces(intensity, W, H, palette), [burstKey, intensity]);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.linear });
    const t = setTimeout(() => onDone?.(), DURATION + 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => <ConfettiPiece key={`${burstKey}-${i}`} p={p} progress={progress} />)}
    </View>
  );
}

/* ─────────────────────────── global celebrate() ─────────────────────────── */

export type CelebrateOptions = {
  intensity?: Intensity;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  haptic?: boolean;
};

type CelebrateFn = (opts?: CelebrateOptions) => void;
const CelebrationCtx = createContext<CelebrateFn>(() => {});

/** Fire a celebration that survives navigation (rendered above the whole Stack). */
export function useCelebrate() {
  return useContext(CelebrationCtx);
}

function CelebrationToast({ title, subtitle, icon, reduce }: { title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; reduce: boolean }) {
  const { colors, isDark } = useTheme();
  const a = useSharedValue(0);
  useEffect(() => {
    a.value = withSequence(
      withTiming(1, { duration: reduce ? 220 : 380, easing: Easing.out(Easing.back(1.6)) }),
      withDelay(1700, withTiming(0, { duration: 420 })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, a.value),
    transform: reduce ? [] : [{ translateY: interpolate(a.value, [0, 1], [-18, 0]) }, { scale: interpolate(a.value, [0, 1], [0.92, 1]) }],
  }));
  const gold = isDark ? "#E2BE6E" : "#8C6A26";
  return (
    <Animated.View pointerEvents="none" style={[toastStyles.wrap, style]}>
      <View style={[toastStyles.card, {
        backgroundColor: isDark ? "rgba(14,12,9,0.94)" : "rgba(251,246,236,0.97)",
        borderColor: isDark ? "rgba(226,190,110,0.55)" : "rgba(140,106,38,0.4)",
        shadowColor: isDark ? "#000" : "#8C6A26",
      }]}>
        <View style={[toastStyles.medal, { borderColor: gold, backgroundColor: isDark ? "rgba(226,190,110,0.12)" : "rgba(176,138,62,0.12)" }]}>
          <Ionicons name={icon} size={22} color={gold} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={[toastStyles.title, { color: gold }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[toastStyles.sub, { color: colors.textSubtle }]} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  wrap: { position: "absolute", top: "14%", left: 24, right: 24, alignItems: "center" },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 22, borderWidth: 1, shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  medal: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 24, letterSpacing: 0.3 },
  sub: { fontSize: 13, marginTop: 2 },
});

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const [burst, setBurst] = useState<{ key: number; opts: CelebrateOptions } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const celebrate = useCallback<CelebrateFn>((opts = {}) => {
    if (opts.haptic !== false) hapticSuccess();
    if (timer.current) clearTimeout(timer.current);
    setBurst({ key: Date.now(), opts });
    timer.current = setTimeout(() => setBurst(null), 3000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <CelebrationCtx.Provider value={celebrate}>
      <View style={{ flex: 1 }}>
        {children}
        {burst ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="celebration-overlay">
            {!reduce && <Confetti burstKey={burst.key} intensity={burst.opts.intensity || "big"} />}
            {burst.opts.title ? (
              <CelebrationToast key={burst.key} title={burst.opts.title} subtitle={burst.opts.subtitle} icon={burst.opts.icon || "sparkles"} reduce={reduce} />
            ) : null}
          </View>
        ) : null}
      </View>
    </CelebrationCtx.Provider>
  );
}

/* ─────────────────────────── success seal ─────────────────────────── */

const BEADS = 44;

function Bead({ i, cx, cy, R, progress, color }: { i: number; cx: number; cy: number; R: number; progress: SharedValue<number>; color: string }) {
  const ang = (i / BEADS) * Math.PI * 2 - Math.PI / 2;
  const x = cx + Math.cos(ang) * R;
  const y = cy + Math.sin(ang) * R;
  const style = useAnimatedStyle(() => {
    const v = Math.max(0, Math.min(1, (progress.value - i / BEADS) * BEADS));
    return { opacity: v, transform: [{ scale: 0.4 + 0.6 * v }] };
  });
  return <Animated.View style={[{ position: "absolute", left: x - 2.5, top: y - 2.5, width: 5, height: 5, borderRadius: 3, backgroundColor: color }, style]} />;
}

/** Gold ring draws itself clockwise, the seal fills and the check pops. */
export function SuccessSeal({ size = 104, testID }: { size?: number; testID?: string }) {
  const { colors, isDark } = useTheme();
  const reduce = useReduceMotion();
  const gold = isDark ? "#E2BE6E" : "#B08A3E";
  const ring = useSharedValue(0);
  const seal = useSharedValue(0);
  const check = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      ring.value = withTiming(1, { duration: 250 });
      seal.value = withTiming(1, { duration: 250 });
      check.value = withTiming(1, { duration: 250 });
      return;
    }
    ring.value = withTiming(1, { duration: 720, easing: Easing.inOut(Easing.cubic) });
    seal.value = withDelay(520, withSpring(1, { damping: 10, stiffness: 140 }));
    check.value = withDelay(760, withSequence(withTiming(1.28, { duration: 170 }), withSpring(1, { damping: 7, stiffness: 220 })));
    halo.value = withDelay(820, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const box = size + 36;
  const c = box / 2;
  const sealStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, seal.value * 1.5), transform: [{ scale: reduce ? 1 : 0.5 + 0.5 * seal.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, check.value), transform: [{ scale: reduce ? 1 : check.value }, { rotate: `${(1 - Math.min(1, check.value)) * -25}deg` }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: (1 - halo.value) * 0.55, transform: [{ scale: 1 + halo.value * 0.45 }] }));

  return (
    <View testID={testID} pointerEvents="none" style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: gold }, haloStyle]} />
      <View style={{ position: "absolute", width: size + 26, height: size + 26, borderRadius: (size + 26) / 2, borderWidth: 1, borderColor: gold + "33" }} />
      {Array.from({ length: BEADS }).map((_, i) => <Bead key={i} i={i} cx={c} cy={c} R={(size + 26) / 2} progress={ring} color={gold} />)}
      <Animated.View style={[{
        width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
        borderWidth: 3, borderColor: isDark ? "#F3E3B5" : "#E2BE6E",
        shadowColor: gold, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8,
      }, sealStyle]}>
        <Animated.View style={checkStyle}>
          <Ionicons name="checkmark" size={size * 0.5} color={colors.onBrand} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────── heart pop ─────────────────────────── */

const SPARKS = 8;

function Spark({ i, progress, color }: { i: number; progress: SharedValue<number>; color: string }) {
  const ang = (i / SPARKS) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const d = 8 + progress.value * 18;
    return {
      opacity: progress.value <= 0 || progress.value >= 1 ? 0 : 1 - progress.value,
      transform: [{ translateX: Math.cos(ang) * d }, { translateY: Math.sin(ang) * d }, { scale: 1 - progress.value * 0.6 }],
    };
  });
  return <Animated.View style={[{ position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: color }, style]} />;
}

/** Wrap a heart icon: it springs + throws gold sparks when `active` turns on. */
export function HeartPop({ active, children }: { active: boolean; children: ReactNode }) {
  const reduce = useReduceMotion();
  const palette = useConfettiColors();
  const scale = useSharedValue(1);
  const sparks = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduce) return;
    if (active) {
      scale.value = withSequence(withTiming(0.6, { duration: 90 }), withSpring(1, { damping: 5, stiffness: 260 }));
      sparks.value = 0;
      sparks.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) });
    } else {
      scale.value = withSequence(withTiming(0.85, { duration: 80 }), withSpring(1, { damping: 12 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="none" style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        {Array.from({ length: SPARKS }).map((_, i) => <Spark key={i} i={i} progress={sparks} color={palette[i % palette.length]} />)}
      </View>
      <Animated.View style={style}>{children}</Animated.View>
    </View>
  );
}
