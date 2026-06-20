import { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useChatWebSocket } from "@/src/hooks/use-chat-ws";
import { colors, radius, spacing } from "@/src/theme";

export default function ChatThread() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);

  useEffect(() => {
    api.get(`/chat/messages/${bookingId}`).then(setMsgs).catch(console.warn);
  }, [bookingId]);

  const { status, send, sendTyping } = useChatWebSocket(bookingId as string, (ev) => {
    if (ev.type === "message") {
      setMsgs(prev => prev.some(m => m.id === ev.message.id) ? prev : [...prev, ev.message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } else if (ev.type === "typing") {
      if (ev.user_id !== user?.id) {
        setOtherTyping(ev.sender_name);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setOtherTyping(null), 2500);
      }
    }
  });

  const onChangeText = (t: string) => {
    setText(t);
    sendTyping();
  };

  const handleSend = () => {
    if (!text.trim()) return;
    send(text.trim());
    setText("");
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Conversation</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.dot, { backgroundColor: status === "open" ? colors.success : status === "connecting" ? colors.warning : colors.textMuted }]} />
            <Text style={styles.statusT}>{status === "open" ? "Live" : status === "connecting" ? "Connecting…" : "Offline"}</Text>
          </View>
        </View>
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
        ListFooterComponent={otherTyping ? (
          <View style={[styles.bubble, styles.theirs, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
            <View style={styles.typingDots}>
              <View style={[styles.tDot, { animationDelay: "0s" } as any]} />
              <View style={[styles.tDot, { animationDelay: "0.2s" } as any]} />
              <View style={[styles.tDot, { animationDelay: "0.4s" } as any]} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontStyle: "italic" }}>{otherTyping} is typing…</Text>
          </View>
        ) : null}
      />
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput testID="msg-input" value={text} onChangeText={onChangeText} placeholder="Type a message..."
          placeholderTextColor={colors.textMuted} style={styles.input} />
        <Pressable testID="msg-send" onPress={handleSend} style={styles.sendBtn}>
          <Ionicons name="send" size={18} color={colors.onBrand} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  statusT: { color: colors.textMuted, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  mine: { backgroundColor: colors.brand, alignSelf: "flex-end" },
  theirs: { backgroundColor: colors.surface2, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border },
  typingDots: { flexDirection: "row", gap: 3 },
  tDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.textMuted },
  inputRow: { flexDirection: "row", padding: spacing.lg, gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
