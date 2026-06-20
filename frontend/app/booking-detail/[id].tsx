import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton, Rating } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [b, setB] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.get(`/bookings/${id}`).then(setB); }, [id]);

  const submitReview = async () => {
    setSubmitting(true);
    try { await api.post("/reviews", { vendor_id: b.vendor_id, booking_id: b.id, rating, comment }); alert("Thanks for your review!"); setComment(""); }
    catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Booking Details</Text>
      </View>
      <Image source={{ uri: b.vendor_cover }} style={styles.cover} contentFit="cover" />
      <View style={{ padding: spacing.xl, gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "500" }}>{b.vendor_name}</Text>
        <View style={[styles.tag, { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
          <Text style={{ color: colors.brand, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>{b.status.toUpperCase()}</Text>
        </View>
        <View style={styles.card}>
          <Row k="Event" v={b.event_type} /><Row k="Date" v={b.event_date} />
          <Row k="Guests" v={String(b.guests)} /><Row k="Amount" v={`₹${b.amount.toLocaleString("en-IN")}`} bold />
          <Row k="Payment" v={b.payment_status} />
          {b.notes ? <Text style={{ color: colors.textSubtle, marginTop: 8, fontStyle: "italic" }}>"{b.notes}"</Text> : null}
        </View>
        <Pressable onPress={() => router.push(`/chat/${b.id}`)} style={styles.chatBtn}>
          <Ionicons name="chatbubbles" size={18} color={colors.brand} />
          <Text style={{ color: colors.brand, fontWeight: "500" }}>Message Vendor</Text>
        </Pressable>
        {b.status === "completed" && (
          <View style={styles.card}>
            <Text style={{ color: colors.text, fontWeight: "500", fontSize: 16 }}>Leave a Review</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {[1,2,3,4,5].map(n => (
                <Pressable key={n} onPress={() => setRating(n)} testID={`star-${n}`}>
                  <Ionicons name={n <= rating ? "star" : "star-outline"} size={28} color={colors.brand} />
                </Pressable>
              ))}
            </View>
            <TextInput value={comment} onChangeText={setComment} placeholder="Share your experience..." placeholderTextColor={colors.textMuted} style={styles.input} multiline testID="review-text" />
            <GoldButton testID="review-submit" title="Submit Review" onPress={submitReview} loading={submitting} style={{ marginTop: spacing.md }} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
    <Text style={{ color: colors.textMuted }}>{k}</Text><Text style={{ color: bold ? colors.brand : colors.text, fontWeight: bold ? "600" : "500" }}>{v}</Text>
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  cover: { width: "100%", height: 200, marginTop: spacing.md },
  tag: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
  card: { marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  chatBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand },
  input: { backgroundColor: colors.surface3, borderRadius: radius.md, padding: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md, minHeight: 80, textAlignVertical: "top" },
});
