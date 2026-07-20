import { useState } from "react";
import { View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { GoldButton } from "@/src/components/UI";
import { TharaLogo } from "@/src/components/TharaLogo";
import { radius, spacing, useThemedStyles } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    brandWrap: { alignItems: "center", paddingHorizontal: spacing.xl },
    tag: { color: "rgba(255,255,255,0.75)", marginTop: 10, fontStyle: "italic", fontSize: 12, letterSpacing: 0.5 },
    cardWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: 60 },
    blurCard: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(212,175,55,0.28)" },
    cardInner: { padding: 22, backgroundColor: "rgba(20,20,26,0.62)" },
    title: { color: "#F3F4F6", fontSize: 22, fontWeight: "500" },
    subtitle: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
    input: {
      backgroundColor: "rgba(255,255,255,0.09)", borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
      color: "#F3F4F6", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", fontSize: 14, marginBottom: 10,
    },
    err: { color: "#FF8A8A", marginBottom: 8, fontSize: 12 },
    linkMuted: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
    demoHint: { color: "rgba(255,255,255,0.45)", fontSize: 10, textAlign: "center", marginTop: 14, letterSpacing: 0.3 },
    brandLink: { color: c.brand, fontWeight: "600" },
  }));

  const submit = async () => {
    setErr(null); setLoading(true);
    try {
      const u = await signIn(email.trim().toLowerCase(), password);
      router.replace(u.role === "vendor" ? "/(vendor)/dashboard" : "/(customer)/home");
    } catch (e: any) { setErr(e.message || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg" }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
      <LinearGradient colors={["rgba(11,12,16,0.35)", "rgba(11,12,16,0.85)", "rgba(11,12,16,0.98)"]}
        locations={[0, 0.45, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.brandWrap, { paddingTop: insets.top + 48 }]}>
          <TharaLogo variant="wordmark" width={220} forceMode="dark" />
          <Text style={styles.tag}>India's premium celebration marketplace</Text>
        </View>

        <View style={styles.cardWrap}>
          <BlurView intensity={Platform.OS === "ios" ? 35 : 50} tint="dark" style={styles.blurCard}>
            <View style={styles.cardInner}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue</Text>
              <View style={{ height: spacing.lg }} />
              <TextInput testID="login-email" value={email} onChangeText={setEmail} placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.5)" style={styles.input}
                autoCapitalize="none" keyboardType="email-address" />
              <TextInput testID="login-password" value={password} onChangeText={setPassword} placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.5)" style={styles.input} secureTextEntry />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <GoldButton testID="login-submit" title="Sign In" onPress={submit} loading={loading} style={{ marginTop: 4 }} />
              <Pressable testID="goto-signup" onPress={() => router.push("/(auth)/signup")} style={{ marginTop: 12, alignItems: "center" }}>
                <Text style={styles.linkMuted}>
                  New here? <Text style={styles.brandLink}>Create account</Text>
                </Text>
              </Pressable>
            </View>
          </BlurView>
          <Text style={styles.demoHint}>
            Demo · customer.demo@eventpro.in / Demo@123
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
