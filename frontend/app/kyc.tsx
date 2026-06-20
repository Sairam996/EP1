import { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { GoldButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Kyc() {
  const insets = useSafeAreaInsets();
  const [biz, setBiz] = useState(""); const [gst, setGst] = useState(""); const [pan, setPan] = useState("");
  const [addr, setAddr] = useState(""); const [status, setStatus] = useState<string>("loading");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/kyc/me").then(r => setStatus(r.status)); }, []);

  const submit = async () => {
    if (!biz || !pan || !addr) { alert("Please fill all required fields"); return; }
    setLoading(true);
    try {
      const r = await api.post("/kyc", { business_name: biz, gst_number: gst, pan_number: pan, address: addr, document_url: "" });
      setStatus(r.status);
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>KYC Verification</Text>
      </View>
      {status === "approved" ? (
        <View style={{ alignItems: "center", padding: spacing.xxl, gap: 12 }}>
          <View style={styles.okCircle}><Ionicons name="checkmark" size={40} color={colors.onBrand} /></View>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "500" }}>You're Verified ✨</Text>
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>Your business is verified. The gold badge is now on your listing.</Text>
        </View>
      ) : (
        <View style={{ padding: spacing.xl, gap: 6 }}>
          <Text style={{ color: colors.textSubtle, marginBottom: spacing.md }}>Complete KYC to earn the Verified badge & higher visibility.</Text>
          <Text style={styles.lbl}>Business Name *</Text>
          <TextInput value={biz} onChangeText={setBiz} placeholder="Registered name" placeholderTextColor={colors.textMuted} style={styles.input} testID="kyc-biz" />
          <Text style={styles.lbl}>PAN Number *</Text>
          <TextInput value={pan} onChangeText={setPan} placeholder="ABCDE1234F" placeholderTextColor={colors.textMuted} style={styles.input} autoCapitalize="characters" testID="kyc-pan" />
          <Text style={styles.lbl}>GST Number</Text>
          <TextInput value={gst} onChangeText={setGst} placeholder="22AAAAA0000A1Z5" placeholderTextColor={colors.textMuted} style={styles.input} autoCapitalize="characters" testID="kyc-gst" />
          <Text style={styles.lbl}>Business Address *</Text>
          <TextInput value={addr} onChangeText={setAddr} placeholder="Full address" placeholderTextColor={colors.textMuted} style={[styles.input, { height: 80, textAlignVertical: "top" }]} multiline testID="kyc-addr" />
          <GoldButton testID="kyc-submit" title="Submit KYC" onPress={submit} loading={loading} style={{ marginTop: spacing.lg }} />
        </View>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  lbl: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  okCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
