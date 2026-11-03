import { useEffect, useMemo, useRef, useState } from "react";
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
  Linking,
  StyleSheet,
} from "react-native";
import Constants from "expo-constants";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { GoldButton, Pill } from "@/src/components/UI";
import { BACKEND_BASE } from "@/src/api";
import { TharaLogo } from "@/src/components/TharaLogo";
import { LaunchIntro } from "@/src/components/LaunchIntro";
import { BokehBackground } from "@/src/components/BokehBackground";
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
  const [resendIn, setResendIn] = useState(0);
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const otpRef = useRef<any>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
        backgroundColor: dark ? "rgba(8,8,8,0.62)" : "rgba(255,252,245,0.70)",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: dark ? "rgba(226,190,110,0.35)" : "rgba(140,106,38,0.25)",
        borderRadius: 24,
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
        paddingVertical: 0,
        height: 60,
        color: c.text,
        borderWidth: 1,
        borderColor: dark ? "rgba(226,190,110,0.28)" : "rgba(140,106,38,0.22)",
        fontSize: 19,
        letterSpacing: 0.5,
        marginBottom: 12,
      },
      phoneRow: { flexDirection: "row" as const, gap: 10, marginBottom: 14 },
      ccBtn: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 4,
        paddingHorizontal: 14,
        height: 60,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: dark ? "rgba(226,190,110,0.28)" : "rgba(140,106,38,0.22)",
        backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
      },
      ccText: { color: c.text, fontSize: 18, fontWeight: "600" as const },
      phoneInput: { flex: 1, marginBottom: 0 },
      otpInput: {
        letterSpacing: 10,
        fontSize: 22,
        textAlign: "center" as const,
        fontWeight: "600" as const,
      },
      err: { color: c.error, marginBottom: 8, fontSize: 12 },
      hint: { color: c.textMuted, fontSize: 14, marginBottom: 10 },
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
      heading: { color: c.text, fontSize: 28, fontFamily: fonts.displayBold, letterSpacing: 0.4, marginBottom: spacing.lg },
      otpHeaderRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: spacing.md },
      sentLine: { color: c.textMuted, fontSize: 15, marginBottom: spacing.lg },
      changeLink: { color: c.brand, fontWeight: "700" as const },
      otpBoxes: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginBottom: spacing.lg },
      otpBox: {
        width: 50, height: 64, borderRadius: radius.md, alignItems: "center" as const, justifyContent: "center" as const,
        borderWidth: 1, borderColor: c.border,
        backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
      },
      otpBoxActive: { borderColor: c.brand, borderWidth: 2 },
      otpDigit: { color: c.text, fontSize: 28, fontWeight: "700" as const },
      hiddenOtp: { position: "absolute" as const, opacity: 0.01, width: 1, height: 1 },
      resendRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: spacing.lg },
      pills: { flexDirection: "row" as const, gap: 8 },
      chPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
      chPillOn: { borderColor: c.brand, backgroundColor: c.brandTint },
      chPillText: { color: c.text, fontSize: 12, fontWeight: "600" as const },
      terms: { color: c.textMuted, fontSize: 11, textAlign: "center" as const, marginTop: spacing.md, lineHeight: 16 },
      termsLink: { color: c.brand, fontWeight: "600" as const },
      resend: { color: c.brand, fontSize: 13, fontWeight: "600" as const, marginTop: 8, textAlign: "center" as const },
    };
  });

  const routeHome = (role: string) => {
    router.replace(role === "vendor" ? "/(vendor)/dashboard" : "/(customer)/home");
  };

  const digitsOnly = phoneLocal.replace(/\D/g, "");
  const phoneValid = country.code === "+91" ? digitsOnly.length === 10 : digitsOnly.length >= 8;

  const friendly = (e: any, fallback: string) => {
    const m = String(e?.message || "");
    if (/Network request failed|Failed to fetch|aborted|timed out/i.test(m) || !BACKEND_BASE.startsWith("http")) {
      return `Can't reach the Thara server (${BACKEND_BASE || "not configured"}). Check your internet and try again.`;
    }
    return m || fallback;
  };

  const onSendOtp = async () => {
    setErr(null);
    if (!phoneValid) {
      setErr("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const r = await sendOtp(fullPhone);
      setDevOtpHint(r.dev_otp || null);
      setOtp("");
      verifyingRef.current = false;
      setResendIn(30);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (e: any) {
      setErr(friendly(e, "Could not send OTP"));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyOtp = async (code?: string) => {
    const value = (code ?? otp).trim();
    setErr(null);
    if (value.length < 6) {
      setErr("Enter the 6-digit OTP");
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    try {
      const u = await verifyOtp(fullPhone, value);
      if (u.profile_complete || (u.name && u.name.length > 1 && !u.email?.endsWith("@phone.thara.app"))) {
        routeHome(u.role);
        return;
      }
      setUsername(u.name && !u.name.startsWith("+") ? u.name : "");
      setGmail(u.email?.endsWith("@phone.thara.app") ? "" : u.email || "");
      setStep("profile");
    } catch (e: any) {
      setErr(friendly(e, "Invalid OTP"));
      setOtp("");
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  };

  const onOtpChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 6);
    setOtp(cleaned);
    if (cleaned.length === 6) {
      void onVerifyOtp(cleaned); // auto-submit (SMS autofill)
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
    const name = provider === "google" ? "Google" : "Apple";
    const inExpoGo = Constants.appOwnership === "expo" || (Constants as any).executionEnvironment === "storeClient";
    setErr(
      inExpoGo
        ? `${name} sign-in isn't available in Expo Go yet — please use phone OTP for now.`
        : `${name} sign-in is coming soon — please use phone OTP for now.`
    );
  };

  const body = (
    <View style={styles.root}>
      <BokehBackground mode={isDark ? "dark" : "light"} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: Math.max(insets.bottom, 20) + 8,
              paddingTop: insets.top + 36,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandWrap}>
            <TharaLogo variant="full" size={54} tagline testID="login-wordmark" />
          </View>

          <View style={styles.cardWrap}>
            <BlurView
              intensity={Platform.OS === "ios" ? 40 : 55}
              tint={isDark ? "dark" : "light"}
              style={styles.blurCard}
            >
              <View style={styles.cardInner}>
                {step === "phone" ? (
                  <>
                    <Text style={styles.heading}>Login or Signup</Text>
                    <View style={styles.phoneRow}>
                      <Pressable testID="login-country-code" onPress={() => setPickerOpen(true)} style={styles.ccBtn}>
                        <Text style={styles.ccText}>{country.flag} {country.code}</Text>
                        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                      </Pressable>
                      <TextInput
                        testID="login-phone"
                        value={phoneLocal}
                        onChangeText={(t) => setPhoneLocal(t.replace(/\D/g, "").slice(0, country.code === "+91" ? 10 : 14))}
                        placeholder="Enter mobile number"
                        placeholderTextColor={colors.textMuted}
                        style={[styles.input, styles.phoneInput]}
                        keyboardType="number-pad"
                        textContentType="telephoneNumber"
                        autoComplete="tel"
                        maxLength={country.code === "+91" ? 10 : 14}
                      />
                    </View>
                    {err ? <Text style={styles.err}>{err}</Text> : null}
                    <GoldButton
                      testID="login-send-otp"
                      title="Get OTP"
                      onPress={onSendOtp}
                      loading={loading}
                      disabled={!phoneValid}
                      style={{ minHeight: 58 }}
                    />
                    <Text style={styles.terms}>
                      By continuing, you agree to our{" "}
                      <Text style={styles.termsLink} onPress={() => Linking.openURL("https://thara.app/terms")}>Terms of use</Text>
                      {" & "}
                      <Text style={styles.termsLink} onPress={() => Linking.openURL("https://thara.app/privacy")}>Privacy Policy</Text>
                    </Text>
                  </>
                ) : null}

                {step === "otp" ? (
                  <>
                    <View style={styles.otpHeaderRow}>
                      <Pressable
                        testID="login-otp-back"
                        hitSlop={12}
                        onPress={() => { setStep("phone"); setOtp(""); setErr(null); }}
                      >
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                      </Pressable>
                      <Text style={[styles.heading, { marginBottom: 0 }]}>OTP Verification</Text>
                    </View>
                    <Text style={styles.sentLine}>
                      OTP sent via {channel === "sms" ? "SMS" : "WhatsApp"} to {country.code} {digitsOnly}{"  "}
                      <Text style={styles.changeLink} onPress={() => { setStep("phone"); setOtp(""); setErr(null); }}>Change</Text>
                    </Text>
                    <Pressable onPress={() => otpRef.current?.focus()} style={styles.otpBoxes} testID="login-otp-boxes">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <View key={i} style={[styles.otpBox, (i === otp.length || (i === 5 && otp.length === 6)) && styles.otpBoxActive]}>
                          <Text style={styles.otpDigit}>{otp[i] ?? ""}</Text>
                        </View>
                      ))}
                    </Pressable>
                    <TextInput
                      ref={otpRef}
                      testID="login-otp"
                      value={otp}
                      onChangeText={onOtpChange}
                      style={styles.hiddenOtp}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      importantForAutofill="yes"
                      maxLength={6}
                      autoFocus
                      caretHidden
                    />
                    <View style={styles.resendRow}>
                      {resendIn > 0 ? (
                        <Text style={styles.hint}>Resend OTP in 00:{String(resendIn).padStart(2, "0")}</Text>
                      ) : (
                        <Pressable onPress={onSendOtp} disabled={loading} hitSlop={12}>
                          <Text style={[styles.resend, { marginTop: 0 }]}>Resend OTP</Text>
                        </Pressable>
                      )}
                      <View style={styles.pills}>
                        {(["sms", "whatsapp"] as const).map((ch) => (
                          <Pressable key={ch} onPress={() => setChannel(ch)} style={[styles.chPill, channel === ch && styles.chPillOn]}>
                            <Text style={styles.chPillText}>{ch === "sms" ? "SMS" : "WhatsApp"}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    {devOtpHint ? <Text style={styles.hint}>Test code: {devOtpHint}</Text> : null}
                    {err ? <Text style={styles.err}>{err}</Text> : null}
                    <GoldButton
                      testID="login-verify-otp"
                      title="Submit"
                      onPress={() => onVerifyOtp()}
                      loading={loading}
                      disabled={otp.length < 6}
                      style={{ minHeight: 58 }}
                    />
                  </>
                ) : null}
                {step === "profile" ? (
                  <>
                    <Text style={styles.heading}>Set up your profile</Text>
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

                {step !== "profile" ? (
                  <>
                    <Text style={[styles.dividerHint, { marginTop: 18 }]}>or continue with</Text>
                    <View style={[styles.socialRow, { marginTop: 10 }]}>
                      <Pressable testID="login-google" onPress={() => onSocial("google")} style={styles.socialBtn}>
                        <Ionicons name="logo-google" size={18} color={colors.text} />
                        <Text style={styles.socialText}>Google</Text>
                      </Pressable>
                      <Pressable testID="login-apple" onPress={() => onSocial("apple")} style={styles.socialBtn}>
                        <Ionicons name="logo-apple" size={18} color={colors.text} />
                        <Text style={styles.socialText}>Apple</Text>
                      </Pressable>
                    </View>
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
