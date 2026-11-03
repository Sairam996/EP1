/**
 * Thara brand mark — single source of truth for the THARA wordmark.
 *
 * Matches the brand template: ornamental quatrefoil above a wide-tracked,
 * all-caps elegant serif (Cormorant Garamond) in metallic gold on dark,
 * deep charcoal/antique gold on light. Text-based so it stays crisp at
 * every size; falls back to the platform serif if the font isn't loaded.
 */
import React from "react";
import { Image, Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { brandGold, fonts } from "../theme";

const ornamentDark = require("../../assets/brand/thara-ornament-dark.png");
const ornamentLight = require("../../assets/brand/thara-ornament-light.png");

type Variant = "wordmark" | "star" | "full";

export function TharaLogo({
  variant = "wordmark",
  size,
  height,
  width,
  style,
  testID,
  forceMode,
  ornament,
  tagline,
}: {
  /** wordmark = THARA text; full = ornament + THARA (+ optional tagline); star = ornament only */
  variant?: Variant;
  /** Font size of THARA letters. */
  size?: number;
  /** Legacy sizing: approximate overall height / width of the mark. */
  height?: number;
  width?: number;
  style?: ViewStyle;
  testID?: string;
  forceMode?: "light" | "dark";
  ornament?: boolean;
  tagline?: boolean;
}) {
  const { effectiveMode } = useTheme();
  const mode = forceMode ?? effectiveMode;
  const gold = mode === "light" ? brandGold.light : brandGold.dark;
  const orn = mode === "light" ? ornamentLight : ornamentDark;

  // Text width ≈ 5 glyphs * (0.78em + tracking 0.32em) ≈ 5.5em
  const fs = size ?? (width ? width / 5.5 : height ? height * 0.9 : 34);
  const tracking = fs * 0.32;

  if (variant === "star") {
    const s = height ?? width ?? fs * 1.4;
    return (
      <View testID={testID} style={[styles.wrap, style]}>
        <Image source={orn} style={{ width: s, height: s }} resizeMode="contain" />
      </View>
    );
  }
  const showOrn = ornament ?? variant === "full";

  return (
    <View testID={testID} style={[styles.wrap, style]} accessibilityRole="header" accessibilityLabel="Thara">
      {showOrn ? (
        <Image source={orn} style={{ width: fs * 1.25, height: fs * 1.16, marginBottom: fs * 0.18 }} resizeMode="contain" />
      ) : null}
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.display,
          fontSize: fs,
          lineHeight: fs * 1.15,
          letterSpacing: tracking,
          // offset trailing tracking so the word is optically centred
          marginRight: -tracking,
          color: gold,
          textAlign: "center",
          ...(Platform.OS === "ios" ? {} : { includeFontPadding: false }),
        }}
      >
        THARA
      </Text>
      {tagline ? (
        <Text
          allowFontScaling={false}
          style={{ color: gold, fontSize: Math.max(9, fs * 0.24), letterSpacing: fs * 0.07, marginTop: fs * 0.12, opacity: 0.9 }}
        >
          INDIAN EVENTS. TIMELESS BEAUTY.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
