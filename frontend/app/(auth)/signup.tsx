import { useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { GoldButton, Body, Pill } from "@/src/components/UI";
import { TharaLogo } from "@/src/components/TharaLogo";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, useThemedStyles } from "@/src/theme";

const CITIES = ["Hyderabad", "Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"];

export default function Signup() {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const [role, setRole] = useState<"customer" | "vendor">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    title: { color: c.text, fontSize: 28, fontWeight: "500", marginTop: spacing.lg, marginBottom: 4 },
    label: { color: c.textMuted, fontSize: 11, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600" },
    input: {
      backgroundColor: c.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14,
      color: c.text, borderWidth: 1, borderColor: c.border, fontSize: 15,
    },
    roleRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
    roleBtn: {
      flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surface2, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: c.border,
    },
    roleActive: { borderColor: c.brand, backgroundColor: c.brandTint },
    roleText: { color: c.textMuted, fontWeight: "600" },
    err: { color: c.error, marginTop: spacing.md, marginBottom: spacing.sm },
    brandTxt: { color: c.brand },
    logoWrap: { alignItems: "center", marginBottom: spacing.lg },
  }));

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const u = await signUp({ name, email: email.trim().toLowerCase(), phone, password, role, city });
      router.replace(u.role === "vendor" ? "/(vendor)/dashboard" : "/(customer)/home");
    } catch (e: any) { setErr(e.message || "Signup failed"); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: 70 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.logoWrap}>
          <TharaLogo variant="wordmark" width={160} />
        </View>

        <Text style={styles.title}>Create account</Text>
        <Body muted style={{ marginBottom: spacing.lg }}>Join Thara to plan unforgettable celebrations</Body>

        <View style={styles.roleRow} testID="role-selector">
          <Pressable testID="role-customer" onPress={() => setRole("customer")}
            style={[styles.roleBtn, role === "customer" && styles.roleActive]}>
            <Ionicons name="person" size={18} color={role === "customer" ? colors.brand : colors.textMuted} />
            <Text style={[styles.roleText, role === "customer" && { color: colors.brand }]}>Customer</Text>
          </Pressable>
          <Pressable testID="role-vendor" onPress={() => setRole("vendor")}
            style={[styles.roleBtn, role === "vendor" && styles.roleActive]}>
            <Ionicons name="briefcase" size={18} color={role === "vendor" ? colors.brand : colors.textMuted} />
            <Text style={[styles.roleText, role === "vendor" && { color: colors.brand }]}>Vendor</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Full Name</Text>
        <TextInput testID="signup-name" value={name} onChangeText={setName} placeholder="Your name"
          placeholderTextColor={colors.textMuted} style={styles.input} />
        <Text style={styles.label}>Email</Text>
        <TextInput testID="signup-email" value={email} onChangeText={setEmail} placeholder="[email protected]"
          placeholderTextColor={colors.textMuted} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
        <Text style={styles.label}>Phone</Text>
        <TextInput testID="signup-phone" value={phone} onChangeText={setPhone} placeholder="+91 9XXXXXXXXX"
          placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="phone-pad" />
        <Text style={styles.label}>Password</Text>
        <TextInput testID="signup-password" value={password} onChangeText={setPassword} placeholder="At least 6 characters"
          placeholderTextColor={colors.textMuted} style={styles.input} secureTextEntry />
        <Text style={styles.label}>City</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: spacing.md }}>
          {CITIES.map((c) => (
            <Pill key={c} label={c} active={city === c} onPress={() => setCity(c)} testID={`city-${c}`} />
          ))}
        </ScrollView>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <GoldButton testID="signup-submit" title="Create Account" onPress={submit} loading={loading} />
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg, alignItems: "center" }}>
          <Body muted>Already a member? <Text style={styles.brandTxt}>Sign in</Text></Body>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
