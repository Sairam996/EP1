/**
 * Thara brand assets — chooses the correct logo variant for the active theme.
 *
 * Uses require() with a static branch so Metro can bundle both PNGs.
 * Consumers can pick between the full wordmark or a star-only glyph, and
 * optionally override the size.
 */
import React from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

const wordmarkDark = require("../../assets/brand/thara-wordmark-dark-t.png");
const wordmarkLight = require("../../assets/brand/thara-wordmark-light-t.png");
const starDark = require("../../assets/brand/thara-star-dark-t.png");
const starLight = require("../../assets/brand/thara-star-light-t.png");

type Variant = "wordmark" | "star";

export function TharaLogo({
  variant = "wordmark",
  height,
  width,
  style,
  testID,
  forceMode,
}: {
  variant?: Variant;
  height?: number;
  width?: number;
  style?: ViewStyle;
  testID?: string;
  /** Override which palette to draw against — useful when the logo sits on a
   *  gradient/photograph rather than the current app surface. */
  forceMode?: "light" | "dark";
}) {
  const { effectiveMode } = useTheme();
  const mode = forceMode ?? effectiveMode;
  const src =
    variant === "star"
      ? (mode === "light" ? starLight : starDark)
      : (mode === "light" ? wordmarkLight : wordmarkDark);

  // Preserve aspect ratio: wordmark 880x500 (1.76:1), star 480x280 (1.71:1).
  const ratio = variant === "star" ? 480 / 280 : 880 / 500;
  const h = height ?? (width ? width / ratio : 64);
  const w = width ?? h * ratio;

  return (
    <View testID={testID} style={[styles.wrap, style]}>
      <Image source={src} style={{ width: w, height: h }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
