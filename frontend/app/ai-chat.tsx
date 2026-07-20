import { useState, useRef } from "react";
import { View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/api";
import { useTheme } from "@/src/context/ThemeContext";
import { radius, spacing, useThemedStyles } from "@/src/theme";

export default function AIChat() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Namaste! I'm your Thara AI assistant. Ask me anything about planning your celebration — venues, budgets, timelines, vendors. ✨" },
  ]);
  const [text, setText] = useState("");
  const [convoId, setConvoId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList>(null);

  const styles = useThemedStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: c.border },
    title: { color: c.text, fontSize: 18, fontWeight: "600" },
    aiDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
    bubble: { maxWidth: "85%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
    user: { backgroundColor: c.brand, alignSelf: "flex-end" },
    ai: { backgroundColor: c.surface2, alignSelf: "flex-start", borderWidth: 1, borderColor: c.border },
    userText: { color: c.onBrand, fontSize: 14, lineHeight: 20 },
    aiText: { color: c.text, fontSize: 14, lineHeight: 20 },
    inputRow: { flexDirection: "row", padding: spacing.lg, gap: 8, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    input: { flex: 1, backgroundColor: c.surface2, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, color: c.text, borderWidth: 1, borderColor: c.border, maxHeight: 100 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
    thinkingText: { color: c.textMuted },
  }));

  const send = async () => {
    const message = text.trim();
    if (!message || thinking) return;
    setMsgs((p) => [...p, { role: "user", content: message }]);
    setText("");
    setThinking(true);
    try {
      const r = await api.post("/ai/chat", { conversation_id: convoId, message });
      setConvoId(r.conversation_id);
      setMsgs((p) => [...p, { role: "assistant", content: r.reply }]);
    } catch {
      setMsgs((p) => [...p, { role: "assistant", content: "Sorry, I had trouble responding. Try again?" }]);
    } finally { setThinking(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={colors.text} /></Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.aiDot}><Ionicons name="sparkles" size={14} color={colors.onBrand} /></View>
          <Text style={styles.title}>Thara AI</Text>
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
            <Text style={item.role === "user" ? styles.userText : styles.aiText}>{item.content}</Text>
          </View>
        )}
        ListFooterComponent={thinking ? (
          <View style={[styles.bubble, styles.ai, { flexDirection: "row", gap: 8 }]}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.thinkingText}>Thinking…</Text>
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
