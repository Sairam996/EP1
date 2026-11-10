import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { fonts, spacing, useColors, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, KeyValue, ListRow, Section, StatusText, editorialGold, gutter } from "@/src/components/ui";

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [b, setB] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const s = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    cover: { width: "100%", height: 300 },
    back: { position: "absolute", left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
    heroText: { position: "absolute", left: gutter, right: gutter, bottom: 18 },
    name: { color: "#FFF8EB", fontSize: 32, lineHeight: 36, fontFamily: fonts.displayBold, marginTop: 4 },
    notes: { color: c.textSubtle, marginTop: spacing.md, fontStyle: "italic", fontFamily: fonts.display, fontSize: 17, lineHeight: 23 },
    input: { backgroundColor: c.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, padding: 14, color: c.text, marginTop: spacing.md, minHeight: 96, textAlignVertical: "top", fontSize: 15 },
  }));

  useEffect(() => { api.get(`/bookings/${id}`).then(setB); }, [id]);

  const submitReview = async () => {
    setSubmitting(true);
    try { await api.post("/reviews", { vendor_id: b.vendor_id, booking_id: b.id, rating, comment }); alert("Thanks for your review!"); setComment(""); }
    catch (e: any) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  if (!b) return <View style={[s.root, { justifyContent: "center" }]}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 100 }}>
      <View>
        <Image source={{ uri: b.vendor_cover }} style={s.cover} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.85)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={[s.back, { top: insets.top + 8 }]}><Ionicons name="arrow-back" size={20} color="#FFF8EB" /></Pressable>
        <View style={s.heroText}>
          <Text style={{ color: "#E2BE6E", fontSize: 10.5, fontWeight: "700", letterSpacing: 2.2 }}>BOOKING DETAILS</Text>
          <Text style={s.name} numberOfLines={2}>{b.vendor_name}</Text>
          <View style={{ marginTop: 8 }}><StatusText status={b.status} /></View>
        </View>
      </View>

      <Section eyebrow="Your event">
        <KeyValue label="Event" value={String(b.event_type || "").replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase())} />
        <KeyValue label="Date" value={b.event_date} />
        <KeyValue label="Guests" value={String(b.guests)} />
        <KeyValue label="Payment" value={<StatusText status={b.payment_status} />} />
        <KeyValue label="Amount" value={`₹${b.amount.toLocaleString("en-IN")}`} emphasis valueColor={editorialGold(colors)} last />
        {b.notes ? <Text style={s.notes}>“{b.notes}”</Text> : null}
      </Section>

      <View style={{ paddingHorizontal: gutter, marginTop: spacing.lg }}>
        <ListRow icon="chatbubbles-outline" title="Message Vendor" subtitle="Chat about your event details" onPress={() => router.push(`/chat/${b.id}`)} last />
      </View>

      {b.status === "completed" && (
        <Section eyebrow="Share your experience" title="Leave a Review">
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} testID={`star-${n}`} hitSlop={4}>
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={30} color={editorialGold(colors)} />
              </Pressable>
            ))}
          </View>
          <TextInput value={comment} onChangeText={setComment} placeholder="Share your experience..." placeholderTextColor={colors.textMuted} style={s.input} multiline testID="review-text" />
          <GoldButton testID="review-submit" title="Submit Review" onPress={submitReview} loading={submitting} style={{ marginTop: spacing.lg }} />
        </Section>
      )}
      <EyebrowLabel muted style={{ textAlign: "center", marginTop: spacing.xxxl, fontSize: 9.5 }}>{`Ref · ${String(b.id).slice(0, 8)}`}</EyebrowLabel>
    </ScrollView>
  );
}
