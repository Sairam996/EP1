import { View, Text, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EyebrowLabel, editorialGold } from "@/src/components/ui";
import { colors, spacing, themedStyles, useColors } from "@/src/theme";
import type { SocialFields } from "@/src/utils/socialLinks";

const FIELDS: { key: keyof SocialFields; label: string; icon: keyof typeof Ionicons.glyphMap; placeholder: string; testID: string; auto: "username" | "URL" }[] = [
  { key: "instagram_url", label: "Instagram", icon: "logo-instagram", placeholder: "@yourhandle", testID: "link-instagram", auto: "username" },
  { key: "facebook_url", label: "Facebook", icon: "logo-facebook", placeholder: "facebook.com/yourpage", testID: "link-facebook", auto: "username" },
  { key: "website_url", label: "Website", icon: "globe-outline", placeholder: "www.yourstudio.in", testID: "link-website", auto: "URL" },
];

/** Vendor editor: Instagram, Facebook and website inputs with brand icons. */
export function SocialLinkFields({
  value,
  onChange,
  hint = "Customers can open these to see your work before they book.",
}: {
  value: SocialFields;
  onChange: (next: SocialFields) => void;
  hint?: string;
}) {
  const c = useColors();
  const gold = editorialGold(c);
  return (
    <View testID="links-section" style={{ marginTop: spacing.lg }}>
      <EyebrowLabel>Links</EyebrowLabel>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {FIELDS.map((f) => (
        <View key={f.key} style={styles.row}>
          <Ionicons name={f.icon} size={20} color={gold} style={{ width: 22, textAlign: "center" }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lbl}>{f.label}</Text>
            <TextInput
              value={String(value[f.key] || "")}
              onChangeText={(t) => onChange({ ...value, [f.key]: t })}
              placeholder={f.placeholder}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType={f.auto}
              style={styles.input}
              testID={f.testID}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles((c) => ({
  hint: { color: c.textMuted, fontSize: 12.5, marginTop: 6, marginBottom: 4, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: spacing.md },
  lbl: { color: c.textMuted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  input: { backgroundColor: c.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(140,106,38,0.06)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: c.text, fontSize: 15 },
}));
