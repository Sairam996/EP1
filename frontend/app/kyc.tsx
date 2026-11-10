import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { useCelebrate } from "@/src/components/Celebration";
import { colors, fonts, spacing, themedStyles } from "@/src/theme";
import { EyebrowLabel, gutter } from "@/src/components/ui";

export default function Kyc() {
  const insets = useSafeAreaInsets();
  const celebrate = useCelebrate();
  const [biz, setBiz] = useState(""); const [gst, setGst] = useState(""); const [pan, setPan] = useState("");
  const [addr, setAddr] = useState(""); const [status, setStatus] = useState<string>("loading");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/kyc/me").then(r => setStatus(r.status)); }, []);

  const submit = async () => {
    if (!biz || !pan || !addr) { alert("Please fill all required fields"); return; }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase())) { alert("Enter a valid PAN (e.g. ABCDE1234F)"); return; }
    setLoading(true);
    try {
      const r = await api.post("/kyc", { business_name: biz, gst_number: gst, pan_number: pan.trim().toUpperCase(), address: addr, document_url: "" });
      setStatus(r.status);
      celebrate({ intensity: "light", title: "KYC submitted", subtitle: "We\u2019ll verify your business within 1\u20132 days.", icon: "shield-checkmark" });
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back"><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Business Verification</Text>
        <EyebrowLabel>KYC · Thara Partner</EyebrowLabel>
      </View>
      {status === "approved" ? (
        <View style={{ alignItems: "center", padding: spacing.xxl, gap: 12 }}>
          <View style={styles.okCircle}><Ionicons name="checkmark" size={40} color={colors.brand} /></View>
          <Text style={{ color: colors.text, fontSize: 30, fontFamily: fonts.displayBold }}>You{"'"}re Verified</Text>
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>Your business is verified. The gold badge is now on your listing.</Text>
        </View>
      ) : status === "pending" ? (
        <View style={{ alignItems: "center", padding: spacing.xxl, gap: 12 }} testID="kyc-pending">
          <View style={styles.okCircle}><Ionicons name="time-outline" size={38} color={colors.brand} /></View>
          <Text style={{ color: colors.text, fontSize: 30, fontFamily: fonts.displayBold }}>Under Review</Text>
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>Thanks! The Thara team is verifying your details. You{"'"}ll get the Verified badge within 1–2 business days.</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: gutter, paddingTop: spacing.md }}>
          {status === "rejected" && <Text style={{ color: colors.error, marginBottom: spacing.sm }}>Your previous submission needs changes — please re-submit.</Text>}
          <Text style={{ color: colors.textSubtle, marginBottom: spacing.md }}>Complete KYC to get verified — only verified vendors are listed to customers on Thara.</Text>
          <Text style={styles.lbl}>Business Name *</Text>
          <TextInput value={biz} onChangeText={setBiz} placeholder="Registered name" placeholderTextColor={colors.textMuted + "88"} style={styles.input} testID="kyc-biz" />
          <Text style={styles.lbl}>PAN Number *</Text>
          <TextInput value={pan} onChangeText={setPan} placeholder="ABCDE1234F" placeholderTextColor={colors.textMuted + "88"} style={styles.input} autoCapitalize="characters" testID="kyc-pan" />
          <Text style={styles.lbl}>GST Number</Text>
          <TextInput value={gst} onChangeText={setGst} placeholder="22AAAAA0000A1Z5" placeholderTextColor={colors.textMuted + "88"} style={styles.input} autoCapitalize="characters" testID="kyc-gst" />
          <Text style={styles.lbl}>Business Address *</Text>
          <TextInput value={addr} onChangeText={setAddr} placeholder="Full address" placeholderTextColor={colors.textMuted + "88"} style={[styles.input, { height: 80, textAlignVertical: "top" }]} multiline testID="kyc-addr" />
          <GoldButton testID="kyc-submit" title="Submit KYC" onPress={submit} loading={loading} style={{ marginTop: spacing.xxxl }} />
        </View>
      )}
    </ScrollView>
  );
}
const styles = themedStyles((colors) => ({
  header: { paddingHorizontal: gutter, paddingBottom: spacing.sm, gap: 6 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold, marginTop: spacing.md },
  lbl: { color: colors.mode === "dark" ? "#E2BE6E" : "#8C6A26", fontSize: 10.5, fontWeight: "600", marginTop: spacing.xl, marginBottom: 6, letterSpacing: 2, textTransform: "uppercase" },
  // Underline field: soft fill-free input with a gold hairline beneath.
  input: { paddingVertical: 10, paddingHorizontal: 0, color: colors.text, fontSize: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mode === "dark" ? "rgba(226,190,110,0.45)" : "rgba(140,106,38,0.45)" },
  okCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: colors.brand, alignItems: "center", justifyContent: "center" },
}));
