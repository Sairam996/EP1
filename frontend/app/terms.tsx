import { ScrollView, Text, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, fonts, spacing, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, SerifTitle, gutter } from "@/src/components/ui";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Who we are",
    body: "Thara is a marketplace that connects people planning celebrations in India with independent event vendors — venues, caterers, photographers, décor, music and planners. Thara is not the vendor and does not itself provide the booked service.",
  },
  {
    title: "2. Your account",
    body: "You must be 18 or older to use Thara. Keep your phone and email details accurate. You are responsible for activity on your account. Vendors must only list services they can legally provide.",
  },
  {
    title: "3. Bookings",
    body: "A booking request is a request, not a confirmed reservation, until the vendor accepts it. After confirmation, payment is due through Thara checkout. Vendors set their own availability, packages and starting prices. Details on a listing (photos, capacity, inclusions) are provided by the vendor.",
  },
  {
    title: "4. Payments and GST",
    body: "Prices are shown in Indian Rupees. A 5% GST is added to the service amount at checkout. The total you pay is calculated on the server and is the amount charged. Thara Points may be redeemed for up to 20% of the service amount. In live mode, payments are collected via Razorpay.",
  },
  {
    title: "5. Cancellation and refunds",
    body: "You may cancel a pending or confirmed booking from the booking details screen. Unpaid requests can be withdrawn at any time with no charge. For paid bookings: a full refund if you cancel more than 7 days before the event date; a 50% refund between 2 and 7 days; no refund within 48 hours of the event. Refunds are returned to the original payment method. The vendor may also decline a request before it is paid.",
  },
  {
    title: "6. Conduct",
    body: "Do not misuse the app, post false listings, or harass other users. Thara may suspend accounts that break these rules or applicable law.",
  },
  {
    title: "7. Liability",
    body: "Vendors are responsible for the service they deliver. To the extent permitted by law, Thara is not liable for a vendor’s delay, cancellation, or quality of work, beyond facilitating the booking and any refund due under this policy.",
  },
  {
    title: "8. Changes",
    body: "We may update these terms. The version in this app is the current one. Continued use after a change means you accept the updated terms.",
  },
];

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const s = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    back: { width: 44, height: 44, justifyContent: "center" },
    h: { color: c.text, marginTop: 4 },
    p: { color: c.textSubtle, fontSize: 16, lineHeight: 24, marginTop: 8, fontFamily: fonts.display },
    sec: { color: c.text, fontSize: 20, lineHeight: 26, fontFamily: fonts.displayBold, marginTop: spacing.xl },
    foot: { color: c.textMuted, fontSize: 12, textAlign: "center" as const, marginTop: spacing.xxxl },
  }));
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48 }}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={s.back} accessibilityLabel="Back" testID="terms-back">
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <EyebrowLabel>Legal</EyebrowLabel>
      <SerifTitle size={34} style={s.h}>Terms of use</SerifTitle>
      <Text style={s.p}>Last updated 12 November 2026. These terms govern your use of the Thara app in India.</Text>
      {SECTIONS.map((sec) => (
        <View key={sec.title}>
          <Text style={s.sec}>{sec.title}</Text>
          <Text style={s.p}>{sec.body}</Text>
        </View>
      ))}
      <Text style={s.foot}>Thara  ·  Indian events, timeless beauty.</Text>
    </ScrollView>
  );
}
