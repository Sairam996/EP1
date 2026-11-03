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
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
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
  // Logo gold/black — glossy premier dark
  surface: "#000000",
  surface2: "#0C0C0C",
  surface3: "#1A1A1A",
  text: "#FFF8EB",       // high-contrast warm white (always readable)
  textMuted: "#C4B89A",  // brighter muted for WCAG-ish readability on black
  textSubtle: "#E8DCC4",
  brand: "#D9B25F",       // template metallic gold
  brand2: "#E5C65A",     // lighter gold highlight for glossy accents
  brandTint: "#2E250A",
  onBrand: "#000000",    // black on gold buttons — max contrast
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#D4AF37",
  border: "#2E2A1F",
  borderStrong: "#D4AF37",
  divider: "#1C1C1C",
  overlay: "rgba(0,0,0,0.80)",
  glass: "rgba(12,12,12,0.70)",
};

// N3 light logo palette — pure white, champagne gold mark, charcoal wordmark.
export const lightPalette: Palette = {
  mode: "light",
  surface: "#FBF6EC",      // warm ivory background
  surface2: "#FFFFFF",     // glossy white cards
  surface3: "#F3EADA",     // soft champagne elevated / inputs
  text: "#1C1C1C",         // N3 charcoal THARA
  textMuted: "#5C5344",    // readable taupe on white
  textSubtle: "#2F2A22",
  brand: "#B08A3E",        // antique gold (template)
  brand2: "#A8893E",       // deeper champagne for pressed/hover
  brandTint: "#F4EBD4",    // soft champagne wash
  onBrand: "#1C1C1C",      // charcoal on gold — clear buttons
  success: "#15803D",
  warning: "#B45309",
  error: "#B91C1C",
  info: "#C4A35A",
  border: "#E6DCC4",
  borderStrong: "#C4A35A",
  divider: "#EFE8D8",
  overlay: "rgba(28,28,28,0.38)",
  glass: "rgba(255,255,255,0.86)",
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
export const radius = { sm: 6, md: 12, lg: 18, pill: 999 };
export const fonts = { display: "CormorantGaramond_500Medium", displayBold: "CormorantGaramond_600SemiBold", text: "System" };
// Metallic gold of the THARA wordmark (brand template) per surface.
export const brandGold = { dark: "#E2BE6E", light: "#8C6A26" };

// Shared interaction / layout tokens — prefer these over one-off values.
export const touch = { minTarget: 44, hitSlop: { top: 8, bottom: 8, left: 8, right: 8 } };
export const press = { opacity: 0.85, scale: 0.98, disabledOpacity: 0.5 };
export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "600" as const, letterSpacing: 0.2 },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: "600" as const, letterSpacing: 0.2 },
  h2: { fontSize: 17, lineHeight: 23, fontWeight: "600" as const },
  body: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
};
export const elevation = {
  card: { shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  raised: { shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
};

// -----------------------------------------------------------------------------
// Reactive styles helper (RN 0.88 dropped StyleSheet.NamedStyles)
// -----------------------------------------------------------------------------
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
// Reactive styles helper — preferred for all new / refactored screens.
// -----------------------------------------------------------------------------
export function useThemedStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (c: Palette) => T
): T {
  const { colors: current } = useTheme();
  return useMemo(() => StyleSheet.create(factory(current)) as T, [current]);
}

// Convenience: subscribe to raw palette without styles.
export function useColors(): Palette {
  return useTheme().colors;
}

// -----------------------------------------------------------------------------
// themedStyles — drop-in replacement for module-level `StyleSheet.create` in
// screens that still import the legacy `colors` object. Styles are resolved
// lazily per active palette so text never bakes in the dark palette at import
// time (which produced light-on-cream / dark-on-dark text in light mode).
// -----------------------------------------------------------------------------
export function themedStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (c: Palette) => T
): T {
  const cache: Record<string, T> = {};
  const current = (): T => {
    const key = colors.mode + colors.text + colors.surface;
    return (cache[key] ||= StyleSheet.create(factory(colors)) as T);
  };
  return new Proxy({} as T, {
    get: (_t, prop) => (current() as any)[prop],
    has: (_t, prop) => prop in (current() as any),
    ownKeys: () => Reflect.ownKeys(current() as any),
    getOwnPropertyDescriptor: (_t, prop) => ({ ...Object.getOwnPropertyDescriptor(current() as any, prop), configurable: true }),
  });
}
