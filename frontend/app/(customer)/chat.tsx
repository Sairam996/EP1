import { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { useAuth } from "@/src/context/AuthContext";
import { fonts, spacing, useThemedStyles } from "@/src/theme";
import { Divider, EyebrowLabel, gutter } from "@/src/components/ui";
import { EmptyState } from "@/src/components/Polish";
import { useOnReconnect } from "@/src/hooks/use-reconnect";

export default function ChatList() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    h: { color: c.text, fontSize: 34, lineHeight: 40, fontFamily: fonts.displayBold },
    row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
    av: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface3 },
    name: { color: c.text, fontSize: 19, lineHeight: 23, fontFamily: fonts.displayBold },
    last: { color: c.textMuted, fontSize: 13 },
    empty: { color: c.textMuted },
    emptyMuted: { color: c.textMuted, fontSize: 12 },
    closedHint: { color: c.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 0.6, textTransform: "uppercase" as const },
  }));

  const load = useCallback(async () => {
    try { setItems(await api.get("/chat/threads")); }
    catch (e) { console.warn(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useOnReconnect(load);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={{ paddingHorizontal: gutter, marginTop: spacing.md, marginBottom: spacing.sm, gap: 4 }}>
        <EyebrowLabel>Conversations</EyebrowLabel>
        <Text style={styles.h}>Messages</Text>
      </View>
      {loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 30 }} /> : (
        <FlatList initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7} showsVerticalScrollIndicator={false}
          data={items.filter((it) => it.status !== "rejected" && it.status !== "cancelled")}
          keyExtractor={(it) => it.booking_id}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <Divider inset={70} />}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={{ marginTop: 40 }}>
              <EmptyState icon="chatbubbles-outline" title="No conversations yet" message="Book a partner to start chatting." />
            </View>
          }
          ListFooterComponent={(() => {
            const closed = items.filter((it) => it.status === "rejected" || it.status === "cancelled");
            if (!closed.length) return <View />;
            const party = (it: any) => (user?.role === "vendor" ? it.customer_name : it.vendor_name);
            return (
              <View style={{ marginTop: spacing.xl, paddingBottom: spacing.lg }}>
                <EyebrowLabel style={{ marginBottom: 8 }}>Closed</EyebrowLabel>
                {closed.map((item, i) => (
                  <View key={item.booking_id}>
                    {i > 0 ? <Divider inset={70} /> : null}
                    <View testID={`thread-closed-${item.booking_id}`} style={[styles.row, { opacity: 0.55 }]}>
                      <Image source={{ uri: item.vendor_cover }} style={styles.av} contentFit="cover" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.name} numberOfLines={1}>{party(item)}</Text>
                        <Text style={styles.last} numberOfLines={1}>{item.last_message}</Text>
                        <Text style={styles.closedHint}>{item.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}
          renderItem={({ item }) => {
            const name = user?.role === "vendor" ? item.customer_name : item.vendor_name;
            return (
            <Pressable testID={`thread-${item.booking_id}`} onPress={() => router.push(`/chat/${item.booking_id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <Image source={{ uri: item.vendor_cover }} style={styles.av} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.last} numberOfLines={1}>{item.last_message}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ opacity: 0.6 }} />
            </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
