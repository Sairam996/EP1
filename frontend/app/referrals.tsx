import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Share, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton, GhostButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Referrals() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/me/referral").then(setData); }, []);

  const copy = async () => {
    if (!data?.code) return;
    await Clipboard.setStringAsync(data.code);
    setMsg({ kind: "ok", text: "Code copied to clipboard" });
    setTimeout(() => setMsg(null), 2500);
  };

  const share = async () => {
    if (!data?.share_text) return;
    try {
      if (Platform.OS === "web") {
        if ((navigator as any).share) await (navigator as any).share({ text: data.share_text });
        else { await Clipboard.setStringAsync(data.share_text); setMsg({ kind: "ok", text: "Invite copied — paste anywhere" }); }
      } else {
        await Share.share({ message: data.share_text });
      }
    } catch {}
  };

  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await api.post("/me/apply-referral", { code: code.trim().toUpperCase() });
      setMsg({ kind: "ok", text: `+${r.awarded} points credited!` });
      setCode("");
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message || "Failed" });
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 80 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Refer & Earn</Text>
      </View>
      <View style={{ padding: spacing.xl }}>
        <View style={styles.hero}>
          <Ionicons name="gift" size={32} color={colors.brand} />
          <Text style={styles.heroTitle}>Get ₹200 for every friend</Text>
          <Text style={styles.heroSub}>You both earn 200 points (₹200 off) when they sign up with your code & complete a booking.</Text>
        </View>
        <Text style={styles.lbl}>Your Code</Text>
        <View style={styles.codeBox}>
          <Text testID="my-ref-code" style={styles.code}>{data?.code || "…"}</Text>
          <Pressable testID="copy-code" onPress={copy} style={styles.copyBtn}><Ionicons name="copy" size={16} color={colors.brand} /></Pressable>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
          {data?.invited_count ?? 0} friend{(data?.invited_count ?? 0) === 1 ? "" : "s"} joined
        </Text>
        <GoldButton testID="share-btn" title="Share Invite" icon="share-social" onPress={share} style={{ marginTop: spacing.lg }} />

        <View style={styles.divider} />
        <Text style={styles.lbl}>Have a referral code?</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput testID="apply-code" value={code} onChangeText={setCode} placeholder="EPXXXXXX"
            placeholderTextColor={colors.textMuted} autoCapitalize="characters"
            style={[styles.input, { flex: 1 }]} />
          <GoldButton testID="apply-btn" title="Apply" onPress={apply} loading={busy} style={{ paddingHorizontal: 20 }} />
        </View>
        {msg && <Text style={{ color: msg.kind === "ok" ? colors.success : colors.error, marginTop: 8 }}>{msg.text}</Text>}
        <GhostButton testID="points-link" title="View Points History" icon="wallet" onPress={() => router.push("/points")} style={{ marginTop: spacing.xl }} />
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  hero: { alignItems: "center", padding: spacing.xl, backgroundColor: colors.surface2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand + "55", gap: 8 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: "500", textAlign: "center" },
  heroSub: { color: colors.textSubtle, fontSize: 13, textAlign: "center" },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xl, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  codeBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.brandTint, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, borderStyle: "dashed" },
  code: { color: colors.brand, fontSize: 22, fontWeight: "600", letterSpacing: 4 },
  copyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.xl },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15, letterSpacing: 2 },
});
