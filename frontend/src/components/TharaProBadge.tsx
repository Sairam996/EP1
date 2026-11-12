import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** Small verified mark shown on KYC-approved partner listings. */
export function TharaProBadge({
  variant = "gold",
  style,
  testID = "thara-pro-badge",
}: {
  variant?: "gold" | "onImage";
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const onImage = variant === "onImage";
  const color = onImage ? "#FFF8EB" : "#E2BE6E";
  const iconColor = "#E2BE6E";
  return (
    <View
      testID={testID}
      accessibilityLabel="Thara Pro"
      style={[{ flexDirection: "row", alignItems: "center", gap: 4 }, style]}
    >
      <Ionicons name="checkmark-circle" size={12} color={iconColor} />
      <Text
        style={
          onImage
            ? { color, fontSize: 10, fontWeight: "700", letterSpacing: 1.6, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 }
            : { color, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase" }
        }
      >
        Thara Pro
      </Text>
    </View>
  );
}
