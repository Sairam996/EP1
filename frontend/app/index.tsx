import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { TharaLogo } from "@/src/components/TharaLogo";

export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) {
    return (
      <View style={[styles.c, { backgroundColor: colors.surface }]}>
        <TharaLogo variant="wordmark" width={220} />
        <Text style={[styles.tag, { color: colors.textMuted }]}>Celebrate. Curated.</Text>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 28 }} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "vendor") return <Redirect href="/(vendor)/dashboard" />;
  return <Redirect href="/(customer)/home" />;
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center" },
  tag: { fontSize: 12, letterSpacing: 3, marginTop: 12, textTransform: "uppercase" },
});
