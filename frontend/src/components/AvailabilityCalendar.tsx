/** Black/gold month calendar from the brand template — blocked dates filled gold, open dates outlined. */
import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, useThemedStyles } from "../theme";
import { useTheme } from "../context/ThemeContext";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function AvailabilityCalendar({ blocked }: { blocked: string[] }) {
  const { colors } = useTheme();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const set = useMemo(() => new Set(blocked), [blocked]);
  const s = useThemedStyles((c) => ({
    // Open calendar — no frame; hairlines above/below separate it from the page.
    card: { paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
    title: { color: c.brand, fontFamily: fonts.display, fontSize: 22, letterSpacing: 4, textAlign: "center" },
    nav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 4, marginBottom: 10 },
    month: { color: c.brand, fontSize: 15, letterSpacing: 2, fontWeight: "600" },
    row: { flexDirection: "row" },
    dow: { flex: 1, textAlign: "center", color: c.textMuted, fontSize: 10, letterSpacing: 1, marginBottom: 6 },
    cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 3 },
    dayBox: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", borderRadius: 999 },
    blockedBox: { backgroundColor: c.brand },
    day: { color: c.text, fontSize: 14 },
    blockedDay: { color: c.onBrand, fontWeight: "700" },
    legend: { flexDirection: "row", gap: 18, marginTop: 10, alignItems: "center" },
    lgSq: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.brand },
    lgCi: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: c.text },
    lgT: { color: c.textMuted, fontSize: 11, letterSpacing: 1 },
    note: { marginTop: 12, paddingVertical: 4, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
    noteT: { color: c.brand, fontSize: 11, letterSpacing: 1, fontWeight: "600" },
  }));
  const first = new Date(ym.y, ym.m, 1).getDay();
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (d: number) => setYm(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });

  return (
    <View style={s.card} testID="availability-calendar">
      <Text style={s.title}>AVAILABILITY</Text>
      <View style={s.nav}>
        <Pressable hitSlop={10} onPress={() => shift(-1)}><Ionicons name="chevron-back" size={18} color={colors.brand} /></Pressable>
        <Text style={s.month}>{MONTHS[ym.m]} {ym.y}</Text>
        <Pressable hitSlop={10} onPress={() => shift(1)}><Ionicons name="chevron-forward" size={18} color={colors.brand} /></Pressable>
      </View>
      <View style={s.row}>{DOW.map((d) => <Text key={d} style={s.dow}>{d}</Text>)}</View>
      {Array.from({ length: cells.length / 7 }).map((_, r) => (
        <View key={r} style={s.row}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            const b = d != null && set.has(key(ym.y, ym.m, d));
            return (
              <View key={i} style={s.cell}>
                {d != null ? <View style={[s.dayBox, b && s.blockedBox]}><Text style={[s.day, b && s.blockedDay]}>{d}</Text></View> : null}
              </View>
            );
          })}
        </View>
      ))}
      <View style={s.legend}>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><View style={s.lgSq} /><Text style={s.lgT}>BLOCKED</Text></View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><View style={s.lgCi} /><Text style={s.lgT}>OPEN</Text></View>
      </View>
      <View style={s.note}><Ionicons name="lock-closed-outline" size={13} color={colors.brand} /><Text style={s.noteT}>ONLY OPEN DATES ARE BOOKABLE</Text></View>
    </View>
  );
}
