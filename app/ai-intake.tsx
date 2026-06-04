import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { api } from "@/api/client";
import type { PlanId } from "@/constants/plans";
import { useSession } from "@/session/SessionProvider";
import { colors, fonts, radius, space } from "@/theme/tokens";

// V2 guided-intake chat. An alternative path to the form — maps answers into
// Formstack behind the scenes. Sensitive answers come back flagged and the
// assistant confirms them in-line, so the AI never finalizes a beneficiary on
// its own. Reachable only when EXPO_PUBLIC_AI_INTAKE_ENABLED is set.

type Msg = { role: "user" | "assistant"; text: string };

export default function AiIntake() {
  const { plan } = useLocalSearchParams<{ plan: PlanId }>();
  const { sessionId, track } = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convoId, setConvoId] = useState<string>();
  const [complete, setComplete] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (text: string, isKickoff = false) => {
    if (!text.trim() || sending) return;
    setSending(true);
    if (!isKickoff) setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    try {
      const res = await api.aiIntake({
        session_id: sessionId ?? undefined,
        conversation_id: convoId,
        plan,
        message: text,
      });
      setConvoId(res.conversation_id);
      if (res.reply) setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      if (res.complete) setComplete(true);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Sorry — I had trouble there. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Kick off the conversation on mount.
  useEffect(() => {
    track("questionnaire_opened", "ai_intake", { plan });
    send("Let's begin.", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text variant="h2">Guided assistant</Text>
        <Text variant="small">Beta · I'll map your answers into your questionnaire</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}
            >
              <Text style={[styles.bubbleText, m.role === "user" && styles.userText]}>
                {m.text}
              </Text>
            </View>
          ))}
          {sending ? (
            <View style={[styles.bubble, styles.assistant]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>

        {complete ? (
          <View style={styles.footer}>
            <Button
              title="Review & finish in the questionnaire"
              onPress={() => router.replace({ pathname: "/questionnaire", params: { plan } })}
            />
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type your answer…"
              placeholderTextColor={colors.inkMuted}
              editable={!sending}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <Button title="Send" onPress={() => send(input)} disabled={!input.trim() || sending} style={styles.sendBtn} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: space(6),
    paddingVertical: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: space(1),
  },
  scroll: { padding: space(6), gap: space(3) },
  bubble: { maxWidth: "85%", borderRadius: radius.lg, padding: space(4) },
  assistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignSelf: "flex-start" },
  user: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  userText: { color: colors.onPrimary },
  inputRow: {
    flexDirection: "row",
    gap: space(2),
    padding: space(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space(4),
    height: 48,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  sendBtn: { height: 48, paddingHorizontal: space(5) },
  footer: { padding: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
