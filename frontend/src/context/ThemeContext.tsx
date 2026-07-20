/**
 * ThemeContext — light / dark / system with persistence + reactive palette.
 *
 * Behavior:
 *  - First launch: mode = "system"; the effective palette follows the OS setting.
 *  - User can pick light / dark / system in Settings; stored in AsyncStorage.
 *  - When the mode changes, we also mutate the legacy `colors` module-level
 *    object so components that read colors inline still update on next render.
 *  - Consumers should prefer `useThemedStyles(factory)` from `@/src/theme` to
 *    ensure StyleSheets rebuild when the mode changes.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkPalette, lightPalette, _mutateColors, type Palette } from "../theme";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "thara:theme-mode";

type Ctx = {
  mode: ThemeMode;
  effectiveMode: "light" | "dark";
  colors: Palette;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from storage on mount.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setModeState(stored);
        }
      } catch { /* no-op */ }
      setHydrated(true);
    })();
  }, []);

  const effectiveMode: "light" | "dark" = useMemo(() => {
    if (mode === "system") return systemScheme === "light" ? "light" : "dark";
    return mode;
  }, [mode, systemScheme]);

  const colors = useMemo(() => (effectiveMode === "light" ? lightPalette : darkPalette), [effectiveMode]);

  // Mirror onto the legacy mutable `colors` export so inline reads pick it up.
  useEffect(() => { _mutateColors(colors); }, [colors]);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    try { await AsyncStorage.setItem(STORAGE_KEY, m); } catch { /* no-op */ }
  }, []);

  const toggle = useCallback(() => {
    setMode(effectiveMode === "dark" ? "light" : "dark");
  }, [effectiveMode, setMode]);

  const value = useMemo<Ctx>(
    () => ({ mode, effectiveMode, colors, isDark: effectiveMode === "dark", setMode, toggle }),
    [mode, effectiveMode, colors, setMode, toggle]
  );

  // Avoid a flash of the wrong theme before AsyncStorage hydrates: render
  // children only once we know the persisted preference. Delay is <100ms.
  if (!hydrated) return null;

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) {
    // Fallback for non-provider consumers (e.g. tests). Return a dark-mode
    // shape without persistence.
    return {
      mode: "dark",
      effectiveMode: "dark",
      colors: darkPalette,
      isDark: true,
      setMode: () => {},
      toggle: () => {},
    };
  }
  return c;
}
