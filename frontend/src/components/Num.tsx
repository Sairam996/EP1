import React from "react";
import { Platform, Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { numeric as numericBase } from "@/src/theme";

/** Shared lining / tabular figure style. Use on any Text or TextInput that shows digits. */
export const numeric: TextStyle = {
  ...numericBase,
  ...(Platform.OS === "web" ? ({ fontFeatureSettings: "'tnum' 1, 'lnum' 1" } as TextStyle) : null),
};

/** Numeric-only (or mostly numeric) text: prices, totals, ratings, OTP, counts, percents. */
export function Num({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[numeric, style]} />;
}

/**
 * Mixed editorial copy: keep the parent face (serif for words) and switch only
 * currency, digits, decimals and percents to the lining figure face.
 */
export const NUMERIC_CHUNK =
  /((?:[+\-−–]\s*)?(?:₹\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?(?:%|\+|k|L|Cr)?)/g;

export function splitNumeric(text: string): { text: string; numeric: boolean }[] {
  const out: { text: string; numeric: boolean }[] = [];
  const re = new RegExp(NUMERIC_CHUNK.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), numeric: false });
    out.push({ text: m[0], numeric: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), numeric: false });
  return out.length ? out : [{ text, numeric: false }];
}

function flattenText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  return "";
}

export function NumText({
  children,
  style,
  numStyle,
  ...rest
}: TextProps & { numStyle?: StyleProp<TextStyle> }) {
  const raw = flattenText(children);
  const parts = splitNumeric(raw);
  return (
    <Text {...rest} style={style}>
      {parts.map((part, i) =>
        part.numeric ? (
          <Text key={i} style={[numeric, numStyle]}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}
