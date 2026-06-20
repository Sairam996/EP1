import { useState, useRef } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function AIChat() {
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Namaste! I'm your EventPro AI assistant. Ask me anything about planning your event — venues, budgets, timelines, vendors. ✨" }
  ]);
  const [text, setText] = useState("");
  const [convoId, setConvoId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = async () => {
    const message = text.trim();
    if (!message || thinking) return;
    setMsgs(p => [...p, { role: "user", content: message }]);
    setText("");
    setThinking(true);
    try {
      const r = await api.post("/ai/chat", { conversation_id: convoId, message });
      setConvoId(r.conversation_id);
      setMsgs(p => [...p, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setMsgs(p => [...p, { role: "assistant", content: "Sorry, I had trouble responding. Try again?" }]);
    } finally { setThinking(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.aiDot}><Ionicons name="sparkles" size={14} color={colors.onBrand} /></View>
          <Text style={styles.title}>EventPro AI</Text>
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: spacing.lg, gap: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.user : styles.ai]}>
            <Text style={{ color: item.role === "user" ? colors.onBrand : colors.text, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
          </View>
        )}
        ListFooterComponent={thinking ? (
          <View style={[styles.bubble, styles.ai, { flexDirection: "row", gap: 8 }]}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={{ color: colors.textMuted }}>Thinking…</Text>
          </View>
        ) : null}
      />
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput testID="ai-input" value={text} onChangeText={setText} placeholder="Ask anything..."
          placeholderTextColor={colors.textMuted} style={styles.input} multiline />
        <Pressable testID="ai-send" onPress={send} style={styles.sendBtn} disabled={thinking}>
          <Ionicons name="send" size={18} color={colors.onBrand} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 18, fontWeight: "500" },
  aiDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  user: { backgroundColor: colors.brand, alignSelf: "flex-end" },
  ai: { backgroundColor: colors.surface2, alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border },
  inputRow: { flexDirection: "row", padding: spacing.lg, gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, borderWidth: 1, borderColor: colors.border, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
