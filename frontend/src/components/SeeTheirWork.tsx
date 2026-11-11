import { View, StyleProp, ViewStyle } from "react-native";
import { EyebrowLabel, ListRow, SerifTitle } from "@/src/components/ui";
import { spacing } from "@/src/theme";
import { hasSocialLinks, openSocialLink, pickSocialLinks, type SocialFields } from "@/src/utils/socialLinks";

/** Customer-facing portfolio links. Hidden when none are set. */
export function SeeTheirWork({
  vendor,
  service,
  style,
  testID = "see-their-work",
}: {
  vendor?: SocialFields | null;
  service?: SocialFields | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const items = pickSocialLinks(service, vendor);
  if (!items.length) return null;
  return (
    <View testID={testID} style={[{ marginTop: spacing.lg }, style]}>
      <EyebrowLabel>Portfolio</EyebrowLabel>
      <SerifTitle size={24} style={{ marginTop: 4, marginBottom: 4 }}>See their work</SerifTitle>
      {items.map((it, i) => (
        <ListRow
          key={it.kind}
          testID={`${testID}-${it.kind}`}
          icon={it.icon}
          title={it.label}
          subtitle={it.subtitle}
          onPress={() => { openSocialLink(it.kind, it.url).catch(() => {}); }}
          last={i === items.length - 1}
        />
      ))}
    </View>
  );
}

export { hasSocialLinks };
