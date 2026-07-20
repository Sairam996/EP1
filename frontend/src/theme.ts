/**
 * Thara theme tokens & reactive style helper.
 *
 *  - `darkPalette` / `lightPalette` — full color tokens per mode.
 *  - `colors` — legacy backwards-compat export. Mutated in-place by `ThemeContext`
 *    on mode change so existing `import { colors }` references pick up new values
 *    on next render (best-effort; StyleSheets baked at module-load stay stale
 *    unless the file uses `useThemedStyles`).
 *  - `useThemedStyles(factory)` — preferred hook for new/refactored screens.
 *    Returns a `StyleSheet` that rebuilds when the theme changes.
 */
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useTheme } from "./context/ThemeContext";

export type Palette = {
  mode: "light" | "dark";
  surface: string;   // app background
  surface2: string;  // cards
  surface3: string;  // elevated surfaces / inputs
  text: string;      // primary text
  textMuted: string; // muted text
  textSubtle: string;// secondary text
  brand: string;     // gold accent
  brand2: string;    // brand darker
  brandTint: string; // brand tinted background
  onBrand: string;   // text on brand
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderStrong: string;
  divider: string;
  overlay: string;   // scrim
  glass: string;     // glass card fill
};

export const darkPalette: Palette = {
  mode: "dark",
  surface: "#0B0C10",
  surface2: "#1A1D24",
  surface3: "#262A33",
  text: "#F3F4F6",
  textMuted: "#A1A1AA",
  textSubtle: "#D1D5DB",
  brand: "#D4AF37",
  brand2: "#B5952F",
  brandTint: "#332A0D",
  onBrand: "#0B0C10",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  border: "#262A33",
  borderStrong: "#4B5563",
  divider: "#1A1D24",
  overlay: "rgba(11,12,16,0.72)",
  glass: "rgba(20,20,26,0.55)",
};

// Warm, luxurious light palette — cream / ivory background, warm brass borders,
// deep charcoal text. Gold accent unchanged so the brand reads on both modes.
export const lightPalette: Palette = {
  mode: "light",
  surface: "#F7F1E4",   // warm cream (champagne / ivory)
  surface2: "#FFFCF3",  // milky white cards
  surface3: "#F1E9D6",  // slightly warmer elevated surface / inputs
  text: "#1F1A10",      // deep espresso
  textMuted: "#7A6A4D", // warm taupe
  textSubtle: "#4A3F2A",// darker taupe (still readable secondary)
  brand: "#B08820",     // richer gold on light (better contrast on cream)
  brand2: "#8C6B18",    // brand darker
  brandTint: "#F6EAC7", // soft champagne tint background
  onBrand: "#FFFDF5",   // near-white text on gold
  success: "#166534",
  warning: "#B45309",
  error: "#B91C1C",
  info: "#1D4ED8",
  border: "#E7DDC4",
  borderStrong: "#C8B48A",
  divider: "#EFE7CF",
  overlay: "rgba(31,26,16,0.35)",
  glass: "rgba(255,252,243,0.72)",
};

// Legacy mutable colors object — mutated on theme swap by ThemeContext so any
// component that reads colors during render (inline) reflects the new palette.
export const colors: Palette = { ...darkPalette };

// Called by ThemeContext when the active palette changes.
export function _mutateColors(next: Palette) {
  Object.keys(colors).forEach((k) => delete (colors as any)[k]);
  Object.assign(colors, next);
}

export const spacing = { xs: 4, sm: 6, md: 10, lg: 14, xl: 18, xxl: 24, xxxl: 36 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };
export const fonts = { display: "CormorantGaramond_500Medium", text: "System" };

// -----------------------------------------------------------------------------
// Reactive styles helper — preferred for all new / refactored screens.
// -----------------------------------------------------------------------------
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (c: Palette) => T
): T {
  const { colors: current } = useTheme();
  return useMemo(() => StyleSheet.create(factory(current)) as T, [current]);
}

// Convenience: subscribe to raw palette without styles.
export function useColors(): Palette {
  return useTheme().colors;
}
