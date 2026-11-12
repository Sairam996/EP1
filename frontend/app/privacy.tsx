import { ScrollView, Text, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, fonts, spacing, useThemedStyles } from "@/src/theme";
import { EyebrowLabel, SerifTitle, gutter } from "@/src/components/ui";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Information we collect",
    body: "When you use Thara we collect the details you give us — name, phone, email, city, booking notes, and (for vendors) business profile, KYC documents and payout-related identifiers. We also keep booking, payment, chat and review history, and device tokens so we can send service notifications.",
  },
  {
    title: "2. How we use it",
    body: "We use this information to create your account, show relevant vendors, process bookings and payments, run customer–vendor chat, prevent fraud, and improve the product. We do not sell your personal information.",
  },
  {
    title: "3. Sharing",
    body: "We share what a booking needs with the other party (for example, your name and event date with the vendor). Payment data is handled by our payment partner (Razorpay) when live payments are enabled. We may share information if the law requires it.",
  },
  {
    title: "4. Retention",
    body: "We keep account and booking records for as long as your account is active and as required for tax, dispute and legal purposes. You can ask us to close your account; some records may be retained where the law requires.",
  },
  {
    title: "5. Security",
    body: "We use industry-standard safeguards, including encryption of sensitive KYC fields. No method of transmission is completely secure; please choose a strong password if you use email sign-in.",
  },
  {
    title: "6. Your choices",
    body: "You can update profile details in the app, and you can ask to access or delete your data by writing to us from the email on your account. Push notifications can be turned off in your device settings.",
  },
  {
    title: "7. Children",
    body: "Thara is not directed at children under 18. We do not knowingly collect personal information from minors.",
  },
];

export default function PrivacyScreen() {
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
      <Pressable onPress={() => router.back()} hitSlop={12} style={s.back} accessibilityLabel="Back" testID="privacy-back">
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <EyebrowLabel>Legal</EyebrowLabel>
      <SerifTitle size={34} style={s.h}>Privacy policy</SerifTitle>
      <Text style={s.p}>Last updated 12 November 2026. This policy explains how Thara handles your information.</Text>
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
