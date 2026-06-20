import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/context/AuthContext";
import { GoldButton, Body } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const u = await signIn(email.trim().toLowerCase(), password);
      router.replace(u.role === "vendor" ? "/(vendor)/dashboard" : "/(customer)/home");
    } catch (e: any) { setErr(e.message || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg" }}
          style={styles.hero} contentFit="cover" />
        <LinearGradient colors={["transparent", colors.surface]} style={styles.scrim} />
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>EventPro</Text>
          <Text style={styles.tag}>India's premium event marketplace</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>
          <Body muted style={{ marginBottom: spacing.xl }}>Sign in to plan your next celebration</Body>
          <Text style={styles.label}>Email</Text>
          <TextInput testID="login-email" value={email} onChangeText={setEmail} placeholder="[email protected]"
            placeholderTextColor={colors.textMuted} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Password</Text>
          <TextInput testID="login-password" value={password} onChangeText={setPassword} placeholder="••••••••"
            placeholderTextColor={colors.textMuted} style={styles.input} secureTextEntry />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <GoldButton testID="login-submit" title="Sign In" onPress={submit} loading={loading} />
          <Pressable testID="goto-signup" onPress={() => router.push("/(auth)/signup")} style={{ marginTop: spacing.lg, alignItems: "center" }}>
            <Body muted>New here? <Text style={{ color: colors.brand }}>Create an account</Text></Body>
          </Pressable>
          <View style={styles.demo}>
            <Body muted style={{ fontSize: 12 }}>Demo: [email protected] / Demo@123</Body>
            <Body muted style={{ fontSize: 12 }}>Vendor: [email protected] / Vendor@123</Body>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 280, position: "absolute" },
  scrim: { position: "absolute", left: 0, right: 0, top: 100, height: 220 },
  brandWrap: { marginTop: 70, alignItems: "center", paddingHorizontal: spacing.xl },
  brand: { color: colors.brand, fontSize: 44, fontWeight: "300", letterSpacing: 5 },
  tag: { color: colors.textSubtle, marginTop: 4, fontStyle: "italic" },
  form: { marginTop: 200, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: 28, fontWeight: "500" },
  label: { color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14,
    color: colors.text, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  err: { color: colors.error, marginTop: spacing.md, marginBottom: spacing.sm },
  demo: { marginTop: spacing.xxl, padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md, gap: 4 },
});
