import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/src/theme";

type Props = {
  value: string;          // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  testID?: string;
  minDate?: string;
};

const calTheme = {
  calendarBackground: colors.surface2,
  backgroundColor: colors.surface2,
  textSectionTitleColor: colors.textMuted,
  monthTextColor: colors.text,
  arrowColor: colors.brand,
  todayTextColor: colors.brand,
  dayTextColor: colors.text,
  textDisabledColor: "#3a3f4a",
  selectedDayBackgroundColor: colors.brand,
  selectedDayTextColor: colors.onBrand,
  textDayFontWeight: "500" as const,
  textMonthFontWeight: "600" as const,
  textDayFontSize: 14,
  textMonthFontSize: 16,
  textDayHeaderFontSize: 11,
};

export function DateField({ value, onChange, label, placeholder = "Pick a date", testID, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const display = value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable testID={testID} onPress={() => setOpen(true)} style={[styles.field, value && { borderColor: colors.brand }]}>
        <Ionicons name="calendar-outline" size={18} color={value ? colors.brand : colors.textMuted} />
        <Text style={[styles.fieldText, !value && { color: colors.textMuted }]}>{display || placeholder}</Text>
        {value ? <Ionicons name="checkmark-circle" size={16} color={colors.success} /> : <Ionicons name="chevron-down" size={16} color={colors.textMuted} />}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Select Event Date</Text>
              <Pressable onPress={() => setOpen(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
            </View>
            <Calendar
              theme={calTheme as any}
              minDate={minDate || today}
              current={value || today}
              onDayPress={(d: any) => { onChange(d.dateString); setOpen(false); }}
              markedDates={value ? { [value]: { selected: true, selectedColor: colors.brand } } : {}}
              hideExtraDays
              enableSwipeMonths
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 11, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  field: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  fieldText: { flex: 1, color: colors.text, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 18 },
  modal: { backgroundColor: colors.surface2, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "500" },
});
