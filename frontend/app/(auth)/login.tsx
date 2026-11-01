import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { GoldButton, GhostButton, Pill } from "@/src/components/UI";
import { TharaLogo } from "@/src/components/TharaLogo";
import { LaunchIntro } from "@/src/components/LaunchIntro";
import { consumeLaunchIntro } from "@/src/launchGate";
import { fonts, radius, spacing, useThemedStyles } from "@/src/theme";

type Step = "phone" | "otp" | "profile";

const COUNTRY_CODES = [
  { code: "+91", flag: "🇮🇳", label: "India" },
  { code: "+1", flag: "🇺🇸", label: "United States" },
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+44", flag: "🇬🇧", label: "United Kingdom" },
  { code: "+65", flag: "🇸🇬", label: "Singapore" },
  { code: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "+966", flag: "🇸🇦", label: "Saudi Arabia" },
  { code: "+974", flag: "🇶🇦", label: "Qatar" },
];

const CITIES = ["Hyderabad", "Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"];

export default function Login() {
  const insets = useSafeAreaInsets();
  const { sendOtp, verifyOtp, completeProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState<Step>("phone");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [country, setCountry] = useState(COUNTRY_CODES[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [gmail, setGmail] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("Hyderabad");
  const [asPartner, setAsPartner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [playIntro] = useState(() => consumeLaunchIntro());

  const fullPhone = useMemo(() => {
    const digits = phoneLocal.replace(/\D/g, "");
    return digits ? `${country.code}${digits}` : "";
  }, [country.code, phoneLocal]);

  const styles = useThemedStyles((c) => {
    const dark = c.mode === "dark";
    return {
      root: { flex: 1, backgroundColor: c.surface },
      content: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
        width: "100%" as const,
        maxWidth: 440,
        alignSelf: "center" as const,
      },
      brandWrap: { alignItems: "center", marginBottom: spacing.md },
      tharaName: {
        color: c.text,
        fontFamily: fonts.display,
        fontSize: 36,
        letterSpacing: 8,
        fontWeight: "500" as const,
        textAlign: "center" as const,
      },
      welcome: {
        color: c.text,
        fontSize: 26,
        fontWeight: "500" as const,
        letterSpacing: 0.3,
        marginBottom: 4,
      },
      welcomeSub: {
        color: c.textMuted,
        fontSize: 13,
        marginBottom: spacing.md,
      },
      cardWrap: { flexGrow: 1, justifyContent: "center" as const, paddingVertical: spacing.md },
      blurCard: {
        borderRadius: 24,
        overflow: "hidden" as const,
        borderWidth: 0,
        borderColor: "transparent",
      },
      cardInner: {
        padding: 22,
        backgroundColor: dark ? "rgba(12,12,12,0.55)" : "rgba(255,255,255,0.55)",
      },
      label: {
        color: c.textMuted,
        fontSize: 11,
        letterSpacing: 1.1,
        textTransform: "uppercase" as const,
        fontWeight: "600" as const,
        marginBottom: 8,
      },
      input: {
        backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: c.text,
        borderWidth: 0,
        fontSize: 14,
        marginBottom: 10,
      },
      phoneRow: { flexDirection: "row" as const, gap: 8, marginBottom: 10 },
      ccBtn: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 10,
        borderRadius: radius.md,
        borderWidth: 0,
        backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
      },
      ccText: { color: c.text, fontSize: 14, fontWeight: "600" as const },
      phoneInput: { flex: 1, marginBottom: 0 },
      otpInput: {
        letterSpacing: 10,
        fontSize: 22,
        textAlign: "center" as const,
        fontWeight: "600" as const,
      },
      err: { color: c.error, marginBottom: 8, fontSize: 12 },
      hint: { color: c.textMuted, fontSize: 12, marginBottom: 10 },
      footer: {
        alignItems: "center" as const,
        paddingTop: spacing.lg,
        gap: 14,
      },
      socialRow: {
        flexDirection: "row" as const,
        gap: 10,
        width: "100%",
        justifyContent: "center" as const,
      },
      socialBtn: {
        flex: 1,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        gap: 8,
        paddingVertical: 11,
        borderRadius: radius.md,
        borderWidth: 0,
        backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)",
      },
      socialText: { color: c.text, fontSize: 13, fontWeight: "600" as const },
      dividerHint: {
        color: dark ? "rgba(255,248,235,0.28)" : "rgba(28,28,28,0.30)",
        fontSize: 11,
        letterSpacing: 0.6,
        textTransform: "uppercase" as const,
        marginTop: 4,
        marginBottom: 2,
        textAlign: "center" as const,
      },
      partnerRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        paddingVertical: 10,
        marginBottom: 8,
      },
      partnerLabel: { color: c.text, fontSize: 14, fontWeight: "500" as const },
      partnerHint: { color: c.textMuted, fontSize: 11, marginTop: 2 },
      switchTrack: {
        width: 44,
        height: 26,
        borderRadius: 13,
        padding: 3,
        backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      },
      switchTrackOn: { backgroundColor: c.brand },
      switchThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#fff",
      },
      cityRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginBottom: 12 },
      modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end" as const,
      },
      modalSheet: {
        backgroundColor: c.surface2,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 28,
        maxHeight: "55%",
      },
      modalTitle: {
        color: c.text,
        fontSize: 16,
        fontWeight: "600" as const,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: c.divider,
      },
      ccRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.divider,
      },
      ccRowLabel: { color: c.text, fontSize: 15, flex: 1 },
      ccRowCode: { color: c.brand, fontWeight: "700" as const },
      resend: { color: c.brand, fontSize: 13, fontWeight: "600" as const, marginTop: 8, textAlign: "center" as const },
    };
  });

  const gradientColors = useMemo(
    () =>
      isDark
        ? (["#000000", "#0C0C0C", "#1A1408"] as const)
        : (["#FFFFFF", "#FBF7EF", "#F4EBD4"] as const),
    [isDark]
  );

  const routeHome = (role: string) => {
    router.replace(role === "vendor" ? "/(vendor)/dashboard" : "/(customer)/home");
  };

  const onSendOtp = async () => {
    setErr(null);
    if (!fullPhone || phoneLocal.replace(/\D/g, "").length < 8) {
      setErr("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const r = await sendOtp(fullPhone);
      setDevOtpHint(r.dev_otp || null);
      setOtp("");
      setStep("otp");
    } catch (e: any) {
      setErr(e.message || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (code?: string) => {
    const value = (code ?? otp).trim();
    setErr(null);
    if (value.length < 4) {
      setErr("Enter the OTP sent to your phone");
      return;
    }
    setLoading(true);
    try {
      const u = await verifyOtp(fullPhone, value);
      if (u.profile_complete || (u.name && u.name.length > 1 && !u.email?.endsWith("@phone.thara.app"))) {
        routeHome(u.role);
        return;
      }
      setUsername(u.name || "");
      setGmail(u.email?.endsWith("@phone.thara.app") ? "" : u.email || "");
      setStep("profile");
    } catch (e: any) {
      setErr(e.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 6);
    setOtp(cleaned);
    if (cleaned.length === 6) {
      void onVerifyOtp(cleaned);
    }
  };

  const onCompleteProfile = async () => {
    setErr(null);
    if (username.trim().length < 2) {
      setErr("Choose a username");
      return;
    }
    setLoading(true);
    try {
      const u = await completeProfile({
        name: username.trim(),
        email: gmail.trim() || undefined,
        city,
        role: asPartner ? "vendor" : "customer",
      });
      routeHome(u.role);
    } catch (e: any) {
      setErr(e.message || "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  const onSocial = (provider: "google" | "apple") => {
    setErr(
      `${provider === "google" ? "Google" : "Apple"} sign-in is on the UI — connect OAuth keys to go live.`
    );
  };

  const stepTitle =
    step === "phone" ? "Welcome" : step === "otp" ? "Enter OTP" : "Set up your profile";
  const stepSub =
    step === "phone"
      ? "Sign in with your phone to get started"
      : step === "otp"
        ? `We sent a code to ${fullPhone}`
        : "Add your Gmail, username, and preferences";

  const body = (
    <View style={styles.root}>
      <LinearGradient
        colors={[...gradientColors]}
        locations={[0, 0.45, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 8,
              paddingTop: insets.top + (playIntro ? 88 : 36),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandWrap}>
            {!playIntro ? (
              <TharaLogo variant="wordmark" width={210} />
            ) : (
              // LaunchIntro already renders the rising THARA title; keep one brand mark.
              <View style={{ height: 44 }} />
            )}
          </View>

          <View style={styles.cardWrap}>
            <Text style={styles.welcome}>{stepTitle}</Text>
            <Text style={styles.welcomeSub}>{stepSub}</Text>

            <BlurView
              intensity={Platform.OS === "ios" ? 40 : 55}
              tint={isDark ? "dark" : "light"}
              style={styles.blurCard}
            >
              <View style={styles.cardInner}>
                {step === "phone" ? (
                  <>
                    <Text style={styles.label}>Phone login</Text>
                    <View style={styles.phoneRow}>
                      <Pressable
                        testID="login-country-code"
                        onPress={() => setPickerOpen(true)}
                        style={styles.ccBtn}
                      >
                        <Text style={styles.ccText}>
                          {country.flag} {country.code}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                      </Pressable>
                      <TextInput
                        testID="login-phone"
                        value={phoneLocal}
                        onChangeText={setPhoneLocal}
                        placeholder="Phone number"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.input, styles.phoneInput]}
                        keyboardType="phone-pad"
                        textContentType="telephoneNumber"
                        autoComplete="tel"
                      />
                    </View>
                    {err ? <Text style={styles.err}>{err}</Text> : null}
                    <GoldButton
                      testID="login-send-otp"
                      title="Login with phone"
                      onPress={onSendOtp}
                      loading={loading}
                    />
                    <Text style={styles.dividerHint}>or continue with</Text>
                    <View style={[styles.socialRow, { marginTop: 10 }]}>
                      <Pressable
                        testID="login-google"
                        onPress={() => onSocial("google")}
                        style={styles.socialBtn}
                      >
                        <Ionicons name="logo-google" size={18} color={colors.text} />
                        <Text style={styles.socialText}>Google</Text>
                      </Pressable>
                      <Pressable
                        testID="login-apple"
                        onPress={() => onSocial("apple")}
                        style={styles.socialBtn}
                      >
                        <Ionicons name="logo-apple" size={18} color={colors.text} />
                        <Text style={styles.socialText}>Apple</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {step === "otp" ? (
                  <>
                    <Text style={styles.label}>One-time password</Text>
                    <TextInput
                      testID="login-otp"
                      value={otp}
                      onChangeText={onOtpChange}
                      placeholder="••••••"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, styles.otpInput]}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      importantForAutofill="yes"
                      maxLength={6}
                      autoFocus
                    />
                    <Text style={styles.hint}>
                      OTP autofills when your device offers SMS codes.
                    </Text>
                    {devOtpHint ? (
                      <Text style={styles.hint}>Dev code: {devOtpHint}</Text>
                    ) : null}
                    {err ? <Text style={styles.err}>{err}</Text> : null}
                    <GoldButton
                      testID="login-verify-otp"
                      title="Verify OTP"
                      onPress={() => onVerifyOtp()}
                      loading={loading}
                    />
                    <Pressable onPress={onSendOtp} disabled={loading}>
                      <Text style={styles.resend}>Resend code</Text>
                    </Pressable>
                    <GhostButton
                      title="Change number"
                      onPress={() => {
                        setStep("phone");
                        setOtp("");
                        setErr(null);
                      }}
                      style={{ marginTop: 10 }}
                    />
                  </>
                ) : null}

                {step === "profile" ? (
                  <>
                    <Text style={styles.label}>Gmail</Text>
                    <TextInput
                      testID="login-gmail"
                      value={gmail}
                      onChangeText={setGmail}
                      placeholder="you@gmail.com"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                    />
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                      testID="login-username"
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Your name on Thara"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      textContentType="name"
                      autoComplete="name"
                    />
                    <Text style={styles.label}>City</Text>
                    <View style={styles.cityRow}>
                      {CITIES.map((c) => (
                        <Pill
                          key={c}
                          label={c}
                          active={city === c}
                          onPress={() => setCity(c)}
                          testID={`city-${c}`}
                        />
                      ))}
                    </View>
                    <Pressable
                      testID="login-partner-toggle"
                      style={styles.partnerRow}
                      onPress={() => setAsPartner((v) => !v)}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={styles.partnerLabel}>Partner profile</Text>
                        <Text style={styles.partnerHint}>
                          List as a vendor and manage bookings
                        </Text>
                      </View>
                      <View style={[styles.switchTrack, asPartner && styles.switchTrackOn]}>
                        <View
                          style={[
                            styles.switchThumb,
                            { alignSelf: asPartner ? "flex-end" : "flex-start" },
                          ]}
                        />
                      </View>
                    </Pressable>
                    {err ? <Text style={styles.err}>{err}</Text> : null}
                    <GoldButton
                      testID="login-complete-profile"
                      title="Continue"
                      onPress={onCompleteProfile}
                      loading={loading}
                    />
                  </>
                ) : null}
              </View>
            </BlurView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Country code</Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code + item.label}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.ccRow}
                  onPress={() => {
                    setCountry(item);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                  <Text style={styles.ccRowLabel}>{item.label}</Text>
                  <Text style={styles.ccRowCode}>{item.code}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  return (
    <LaunchIntro play={playIntro} testID="login-launch">
      {body}
    </LaunchIntro>
  );
}
