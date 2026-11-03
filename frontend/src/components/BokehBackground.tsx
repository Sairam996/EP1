/**
 * Brand-template backdrop: deep matte black (dark) or warm ivory (light)
 * with soft out-of-focus gold bokeh lights near the edges. Each light is a
 * stack of concentric translucent discs, approximating a radial blur without
 * shipping an image asset.
 */
import { memo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// x/y as fraction of screen, r in px, a = peak alpha
const LIGHTS = [
  { x: 0.95, y: 0.06, r: 46, a: 0.55 }, { x: 0.78, y: 0.03, r: 30, a: 0.35 },
  { x: 1.0, y: 0.3, r: 38, a: 0.35 }, { x: 0.04, y: 0.12, r: 40, a: 0.22 },
  { x: -0.02, y: 0.42, r: 34, a: 0.16 }, { x: 0.98, y: 0.62, r: 42, a: 0.4 },
  { x: 0.02, y: 0.74, r: 36, a: 0.2 }, { x: 0.88, y: 0.92, r: 48, a: 0.45 },
  { x: 0.55, y: 0.98, r: 30, a: 0.2 }, { x: 0.2, y: 0.95, r: 26, a: 0.14 },
];
const RINGS = [1.0, 0.8, 0.62, 0.45];

function Bokeh({ mode }: { mode: "light" | "dark" }) {
  const { width: W, height: H } = useWindowDimensions();
  const dark = mode === "dark";
  const gold = dark ? "226,180,95" : "190,150,70";
  const k = dark ? 1 : 0.55;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={dark ? ["#000000", "#050505", "#0B0906"] : ["#FDF9F1", "#F8F0E0", "#F1E4C8"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {LIGHTS.map((l, i) =>
        RINGS.map((f, j) => {
          const r = l.r * (1 + (1 - f) * 1.6) * (j === 0 ? 1.9 : 1);
          const alpha = (l.a * k * (j + 1)) / (RINGS.length * 2.2);
          return (
            <View
              key={`${i}-${j}`}
              style={{
                position: "absolute",
                left: l.x * W - r,
                top: l.y * H - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: `rgba(${gold},${alpha.toFixed(3)})`,
              }}
            />
          );
        })
      )}
    </View>
  );
}

export const BokehBackground = memo(Bokeh);
