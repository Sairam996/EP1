import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.c}>
        <Text style={styles.brand}>EventPro</Text>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "vendor") return <Redirect href="/(vendor)/dashboard" />;
  return <Redirect href="/(customer)/home" />;
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  brand: { color: colors.brand, fontSize: 42, fontWeight: "300", letterSpacing: 4 },
});
