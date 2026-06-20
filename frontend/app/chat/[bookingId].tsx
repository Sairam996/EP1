import { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function ChatThread() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try { setMsgs(await api.get(`/chat/messages/${bookingId}`)); } catch (e) { console.warn(e); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [bookingId]);

  const send = async () => {
    if (!text.trim()) return;
    const m = await api.post("/chat/messages", { booking_id: bookingId, text: text.trim() });
    setMsgs(prev => [...prev, m]);
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <Text style={styles.title}>Conversation</Text>
      </View>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={{ color: mine ? colors.onBrand : colors.text, fontSize: 14 }}>{item.text}</Text>
            </View>
          );
        }}
      />
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput testID="msg-input" value={text} onChangeText={setText} placeholder="Type a message..."
          placeholderTextColor={colors.textMuted} style={styles.input} />
        <Pressable testID="msg-send" onPress={send} style={styles.sendBtn}>
          <Ionicons name="send" size={18} color={colors.onBrand} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  mine: { backgroundColor: colors.brand, alignSelf: "flex-end" },
  theirs: { backgroundColor: colors.surface2, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border },
  inputRow: { flexDirection: "row", padding: spacing.lg, gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
