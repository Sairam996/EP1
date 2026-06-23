import { useState } from "react";
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { GoldButton } from "@/src/components/UI";
import { colors, radius, spacing } from "@/src/theme";

const { width, height } = Dimensions.get("window");

export default function Login() {
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Full-screen background image */}
      <Image source={{ uri: "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg" }}
        style={StyleSheet.absoluteFillObject} contentFit="cover" />
      <LinearGradient colors={["rgba(11,12,16,0.35)", "rgba(11,12,16,0.85)", "rgba(11,12,16,0.98)"]}
        locations={[0, 0.45, 1]} style={StyleSheet.absoluteFillObject} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Brand */}
        <View style={[styles.brandWrap, { paddingTop: insets.top + 56 }]}>
          <Text style={styles.brand}>EventPro</Text>
          <View style={styles.brandLine} />
          <Text style={styles.tag}>India's premium event marketplace</Text>
        </View>

        {/* Glass login card */}
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
                  New here? <Text style={{ color: colors.brand, fontWeight: "600" }}>Create account</Text>
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

const styles = StyleSheet.create({
  brandWrap: { alignItems: "center", paddingHorizontal: spacing.xl },
  brand: { color: colors.brand, fontSize: 38, fontWeight: "300", letterSpacing: 6 },
  brandLine: { width: 60, height: 1, backgroundColor: colors.brand, opacity: 0.5, marginTop: 6 },
  tag: { color: "rgba(255,255,255,0.7)", marginTop: 8, fontStyle: "italic", fontSize: 12, letterSpacing: 0.5 },
  cardWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: 60 },
  blurCard: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(212,175,55,0.25)" },
  cardInner: { padding: 22, backgroundColor: "rgba(20,20,26,0.55)" },
  title: { color: colors.text, fontSize: 22, fontWeight: "500" },
  subtitle: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 2 },
  input: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", fontSize: 14, marginBottom: 10 },
  err: { color: "#FF8A8A", marginBottom: 8, fontSize: 12 },
  linkMuted: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  demoHint: { color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center", marginTop: 14, letterSpacing: 0.3 },
});
