import { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

export default function ChatList() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    h: { color: c.text, fontSize: 24, fontWeight: "600", paddingHorizontal: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.md },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, backgroundColor: c.surface2, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
    av: { width: 52, height: 52, borderRadius: 26 },
    name: { color: c.text, fontSize: 15, fontWeight: "600" },
    last: { color: c.textMuted, fontSize: 12 },
    empty: { color: c.textMuted },
    emptyMuted: { color: c.textMuted, fontSize: 12 },
  }));

  const load = useCallback(async () => {
    try { setItems(await api.get("/chat/threads")); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.h}>Messages</Text>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.booking_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 80, gap: 8 }}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.textMuted} />
              <Text style={styles.empty}>No conversations yet</Text>
              <Text style={styles.emptyMuted}>Book a vendor to start chatting</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable testID={`thread-${item.booking_id}`} onPress={() => router.push(`/chat/${item.booking_id}`)} style={styles.row}>
              <Image source={{ uri: item.vendor_cover }} style={styles.av} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>{item.vendor_name}</Text>
                <Text style={styles.last} numberOfLines={1}>{item.last_message}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
