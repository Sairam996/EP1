import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, spacing, useColors } from "@/src/theme";
import { TextLink, editorialGold, gutter } from "@/src/components/ui";
import { NumText } from "@/src/components/Num";

/** Fallback when the server has not yet returned cancellation_policy. Keep in sync with backend CANCELLATION_POLICY.summary. */
export const DEFAULT_CANCELLATION_POLICY =
  "The 20% advance is refunded in full if you cancel more than 7 days before the event. "
  + "50% of the advance is refunded between 2 and 7 days. No refund of the advance within 48 hours of the event. "
  + "The remaining 80% is due on the event date, in the app or directly to the partner. "
  + "Unpaid requests can be withdrawn at any time.";

/** Compact muted “Cancellation policy” line; tap opens an editorial bottom sheet with the full text. */
export function PolicyInfo({
  policy,
  testID = "cancel-policy",
}: {
  policy?: string | null;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const text = (policy || DEFAULT_CANCELLATION_POLICY).trim();

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Cancellation policy"
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, alignSelf: "flex-start" }}
      >
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cancellation policy</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          testID="cancel-policy-backdrop"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            testID="cancel-policy-sheet"
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              paddingHorizontal: gutter,
              paddingTop: spacing.xl,
              paddingBottom: insets.bottom + spacing.lg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <Text style={{ color: editorialGold(colors), fontSize: 11, fontWeight: "700", letterSpacing: 2, marginBottom: 8 }}>
              POLICY
            </Text>
            <Text style={{ color: colors.text, fontSize: 28, lineHeight: 34, fontFamily: fonts.displayBold, marginBottom: spacing.md }}>
              Cancellation policy
            </Text>
            <NumText testID="cancel-policy-text" style={{ color: colors.textSubtle, fontSize: 16, lineHeight: 24, fontFamily: fonts.display }}>
              {text}
            </NumText>
            <View style={{ alignItems: "center", marginTop: spacing.xl }}>
              <TextLink title="Close" onPress={() => setOpen(false)} testID="policy-close" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
