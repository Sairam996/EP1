import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, spacing, useColors } from "@/src/theme";
import { Divider, EyebrowLabel, TextLink, editorialGold, gutter } from "@/src/components/ui";
import { GoldButton } from "@/src/components/UI";
import { NumText } from "@/src/components/Num";
import { formatInr } from "@/src/utils/price";

export type MockOutcome = "success" | "failure" | "pending";

/**
 * Test-mode stand-in for Razorpay Checkout (PAYMENT_MODE=mock). No money moves —
 * it lets you walk the success, failure and pending screens end to end in Expo Go.
 */
export function MockPaymentSheet({ visible, amount, methodLabel, onResult, onClose }: {
  visible: boolean;
  amount: number;
  methodLabel: string;
  onResult: (o: MockOutcome) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable testID="mock-pay-backdrop" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
        <Pressable onPress={(e) => e.stopPropagation()} testID="mock-pay-sheet"
          style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: gutter, paddingTop: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ alignSelf: "center", width: 36, height: 3, borderRadius: 2, backgroundColor: editorialGold(colors), opacity: 0.4, marginBottom: spacing.lg }} />
          <EyebrowLabel>Test mode · no money moves</EyebrowLabel>
          <NumText style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 34, marginTop: 8 }}>{`₹${formatInr(amount)}`}</NumText>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>{methodLabel}</Text>
          <Divider style={{ marginVertical: spacing.lg }} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Ionicons name="flask-outline" size={18} color={editorialGold(colors)} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.textSubtle, fontSize: 14, lineHeight: 21, flex: 1 }}>
              Razorpay keys aren&apos;t connected yet, so this sheet stands in for the secure Razorpay step. Choose how this test payment ends.
            </Text>
          </View>
          <GoldButton testID="mock-approve" title="Approve test payment" onPress={() => onResult("success")} style={{ marginTop: spacing.xl }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
            <TextLink testID="mock-fail" title="Decline it" color={colors.textMuted} onPress={() => onResult("failure")} />
            <TextLink testID="mock-pending" title="Leave pending" color={colors.textMuted} onPress={() => onResult("pending")} />
            <TextLink testID="mock-cancel" title="Cancel" color={colors.textMuted} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
