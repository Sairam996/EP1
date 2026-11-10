import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Calendar } from "react-native-calendars";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { fonts, colors, spacing, themedStyles } from "@/src/theme";

const today = () => new Date().toISOString().slice(0, 10);

export default function Availability() {
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState<string[]>([]);
  const [full, setFull] = useState<string[]>([]);
  const [booked, setBooked] = useState<Record<string, number>>({});
  const [maxPerDay, setMaxPerDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, me, bookings] = await Promise.all([
          api.get("/vendor/availability"), api.get("/vendor/me"), api.get("/bookings"),
        ]);
        setBlocked(a.blocked_dates || []); setMaxPerDay(a.max_per_day || 1);
        if (me?.id) {
          const pub = await api.get(`/vendors/${me.id}/availability`, { auth: false });
          setFull(pub.full_dates || []);
        }
        const counts: Record<string, number> = {};
        (bookings || []).filter((b: any) => b.status === "confirmed" || b.status === "completed" || b.payment_status === "paid")
          .forEach((b: any) => { counts[b.event_date] = (counts[b.event_date] || 0) + 1; });
        setBooked(counts);
      } finally { setLoading(false); }
    })();
  }, []);

  const toggle = (d: string) => {
    if (d < today()) return;
    setBlocked((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
    setDirty(true);
  };

  const marked = useMemo(() => {
    const m: Record<string, any> = {};
    Object.keys(booked).forEach((d) => { m[d] = { marked: true, dotColor: colors.success }; });
    full.forEach((d) => {
      m[d] = { ...(m[d] || {}), customStyles: { container: { backgroundColor: colors.success + "33", borderRadius: 8 }, text: { color: colors.success, fontWeight: "700" } } };
    });
    blocked.forEach((d) => {
      m[d] = { ...(m[d] || {}), customStyles: { container: { backgroundColor: colors.error + "33", borderWidth: 1, borderColor: colors.error, borderRadius: 8 }, text: { color: colors.error, textDecorationLine: "line-through", fontWeight: "700" } } };
    });
    return m;
  }, [blocked, full, booked]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/vendor/availability", { blocked_dates: blocked, max_per_day: maxPerDay });
      setDirty(false); setMsg("Availability saved ✓"); setTimeout(() => setMsg(null), 2500);
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const upcomingBlocked = blocked.filter((d) => d >= today());

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Availability</Text>
      </View>
      <View style={{ padding: spacing.xl, gap: 12 }}>
        <Text style={{ color: colors.textSubtle }}>Tap a date to block or unblock it. Customers can{"'"}t book blocked or fully-booked dates.</Text>
        <View style={styles.calWrap}>
          <Calendar
            testID="avail-calendar"
            markingType="custom"
            markedDates={marked}
            minDate={today()}
            onDayPress={(d: any) => toggle(d.dateString)}
            enableSwipeMonths
            hideExtraDays
            theme={{
              calendarBackground: colors.surface2, backgroundColor: colors.surface2,
              textSectionTitleColor: colors.textMuted, monthTextColor: colors.text, arrowColor: colors.brand,
              todayTextColor: colors.brand, dayTextColor: colors.text, textDisabledColor: colors.borderStrong,
              textDayFontWeight: "500", textMonthFontWeight: "600",
            } as any}
          />
        </View>
        <View style={styles.legend}>
          <Legend color={colors.error} label="Blocked" />
          <Legend color={colors.success} label="Fully booked" />
          <Legend color={colors.success} dot label="Has bookings" />
        </View>

        <Text style={styles.lbl}>Max bookings per day</Text>
        <View style={styles.stepper}>
          <Pressable testID="max-minus" onPress={() => { setMaxPerDay((n) => Math.max(1, n - 1)); setDirty(true); }} style={styles.stepBtn}><Ionicons name="remove" size={18} color={colors.brand} /></Pressable>
          <Text testID="max-pd" style={styles.stepVal}>{maxPerDay}</Text>
          <Pressable testID="max-plus" onPress={() => { setMaxPerDay((n) => Math.min(50, n + 1)); setDirty(true); }} style={styles.stepBtn}><Ionicons name="add" size={18} color={colors.brand} /></Pressable>
          <Text style={{ color: colors.textMuted, flex: 1, fontSize: 12 }}>Confirmed or paid bookings count toward this limit.</Text>
        </View>

        <Text style={styles.lbl}>Upcoming blocked dates ({upcomingBlocked.length})</Text>
        {upcomingBlocked.length === 0 ? <Text style={{ color: colors.textMuted }}>None — all dates open</Text> : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {upcomingBlocked.map((d) => (
              <Pressable key={d} onPress={() => toggle(d)} style={styles.chip} testID={`blocked-${d}`}>
                <Text style={{ color: colors.text, fontSize: 12 }}>{new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text>
                <Ionicons name="close" size={14} color={colors.error} />
              </Pressable>
            ))}
          </View>
        )}
        {msg && <Text style={{ color: colors.success }}>{msg}</Text>}
        <GoldButton testID="save-avail" title={dirty ? "Save Changes" : "Saved"} onPress={save} loading={saving} disabled={!dirty} style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}

function Legend({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={dot ? { width: 6, height: 6, borderRadius: 3, backgroundColor: color } : { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: color, backgroundColor: color + "33" }} />
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = themedStyles((colors) => ({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  title: { color: colors.text, fontSize: 18 + 4, fontFamily: fonts.displayBold },
  lbl: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: spacing.md },
  calWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.18)" : "rgba(140,106,38,0.2)" },
  legend: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
  stepVal: { color: colors.text, fontSize: 20, fontWeight: "600", minWidth: 28, textAlign: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 12, paddingVertical: 6 },
}));
