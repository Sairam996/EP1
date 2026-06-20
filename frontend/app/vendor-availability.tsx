import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, FlatList } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Availability() {
  const insets = useSafeAreaInsets();
  const [blocked, setBlocked] = useState<string[]>([]);
  const [maxPerDay, setMaxPerDay] = useState("1");
  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    api.get("/vendor/availability").then(r => { setBlocked(r.blocked_dates || []); setMaxPerDay(String(r.max_per_day || 1)); });
  }, []);

  const save = async () => {
    await api.post("/vendor/availability", { blocked_dates: blocked, max_per_day: parseInt(maxPerDay, 10) });
    alert("Saved!");
  };
  const add = () => { if (newDate && !blocked.includes(newDate)) { setBlocked([...blocked, newDate].sort()); setNewDate(""); } };
  const rm = (d: string) => setBlocked(blocked.filter(x => x !== d));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Availability</Text>
      </View>
      <View style={{ padding: spacing.xl, gap: 12 }}>
        <Text style={styles.lbl}>Max Bookings Per Day</Text>
        <TextInput value={maxPerDay} onChangeText={setMaxPerDay} keyboardType="number-pad" style={styles.input} testID="max-pd" />
        <Text style={styles.lbl}>Block a Date</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={newDate} onChangeText={setNewDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} testID="block-date" />
          <Pressable testID="block-add" onPress={add} style={styles.addBtn}><Ionicons name="add" size={20} color={colors.onBrand} /></Pressable>
        </View>
        <Text style={styles.lbl}>Blocked Dates</Text>
        {blocked.length === 0 ? <Text style={{ color: colors.textMuted }}>None — all dates open</Text> :
          blocked.map(d => (
            <View key={d} style={styles.dateRow}>
              <Text style={{ color: colors.text }}>{d}</Text>
              <Pressable onPress={() => rm(d)}><Ionicons name="close" size={18} color={colors.error} /></Pressable>
            </View>
          ))}
        <GoldButton testID="save-avail" title="Save" onPress={save} style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  lbl: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  addBtn: { backgroundColor: colors.brand, width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  dateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
