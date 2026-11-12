import { ScrollView, Text, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, fonts, spacing, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, SerifTitle, gutter } from "@/src/components/ui";
import { NumText } from "@/src/components/Num";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Who we are",
    body: "Thara is a marketplace that connects people planning celebrations in India with independent event partners — venues, caterers, photographers, décor, music and planners. Thara is not the partner and does not itself provide the booked service.",
  },
  {
    title: "2. Your account",
    body: "You must be 18 or older to use Thara. Keep your phone and email details accurate. You are responsible for activity on your account. Partners must only list services they can legally provide.",
  },
  {
    title: "3. Bookings",
    body: "A booking request is a request, not a reservation, until the partner accepts it. After they accept, you pay a 20% advance in the app to lock the date (status becomes booked). The remaining 80% is due on the event date, either in the app or directly to the partner (the partner must confirm an offline payment). Partners set their own availability, packages and starting prices. Details on a listing (photos, capacity, inclusions) are provided by the partner.",
  },
  {
    title: "4. Payments and GST",
    body: "Prices are shown in Indian Rupees. A 5% GST is added to the service amount. The total (service + GST) is calculated on the server. You pay 20% of that total as an advance to lock the booking; the balance is due on the event date. Thara Points may be redeemed against the advance only, up to the advance amount or 20% of the service amount, whichever is lower. Points are earned on amounts paid in the app. In live mode, in-app payments are collected via Razorpay.",
  },
  {
    title: "5. Cancellation and refunds",
    body: "You may cancel a request or a booked date from the booking details screen, until the balance has been settled. Unpaid requests can be withdrawn at any time with no charge. Refunds apply to the 20% advance only: a full refund of the advance if you cancel more than 7 days before the event; 50% of the advance between 2 and 7 days; no refund of the advance within 48 hours of the event. Refunds are returned to the original payment method. The partner may decline a request before the advance is paid.",
  },
  {
    title: "6. Conduct",
    body: "Do not misuse the app, post false listings, or harass other users. Thara may suspend accounts that break these rules or applicable law.",
  },
  {
    title: "7. Liability",
    body: "Partners are responsible for the service they deliver. To the extent permitted by law, Thara is not liable for a partner’s delay, cancellation, or quality of work, beyond facilitating the booking and any refund due under this policy.",
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
      <NumText style={s.p}>Last updated 12 November 2026. These terms govern your use of the Thara app in India.</NumText>
      {SECTIONS.map((sec) => (
        <View key={sec.title}>
          <Text style={s.sec}>{sec.title}</Text>
          <NumText style={s.p}>{sec.body}</NumText>
        </View>
      ))}
      <Text style={s.foot}>Thara  ·  Indian events, timeless beauty.</Text>
    </ScrollView>
  );
}
