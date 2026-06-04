import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Progress } from "@/components/Progress";
import { TrustBadge } from "@/components/TrustBadge";
import { api } from "@/api/client";
import type { PlanId } from "@/constants/plans";
import { useSession } from "@/session/SessionProvider";
import { colors, fonts, radius, space } from "@/theme/tokens";

const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

export default function Lead() {
  const { plan } = useLocalSearchParams<{ plan: PlanId }>();
  const { sessionId, identifyLead, track } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = emailOk(email);

  const onContinue = async () => {
    setSaving(true);
    try {
      const { lead_id } = await api.saveLead({
        session_id: sessionId ?? undefined,
        email: email.trim(),
        full_name: name.trim() || undefined,
        plan_interest: plan,
      });
      identifyLead(lead_id);
      track("questionnaire_opened", "lead_captured", { plan });
      router.push({ pathname: "/questionnaire", params: { plan } });
    } catch {
      // Don't block the funnel on a lead-save hiccup — proceed anyway.
      track("questionnaire_opened", "lead_save_failed", { plan });
      router.push({ pathname: "/questionnaire", params: { plan } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          title="Continue to questionnaire"
          onPress={onContinue}
          disabled={!valid}
          loading={saving}
        />
      }
    >
      <Progress step={2} total={4} />
      <Text variant="h1" style={styles.heading}>
        Where should we send your documents?
      </Text>
      <Text variant="bodyMuted" style={styles.intro}>
        We'll email your completed trust package and a link to pick up where you
        left off.
      </Text>

      <Text variant="label" style={styles.label}>
        Full name
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Jane Doe"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="words"
      />

      <Text variant="label" style={styles.label}>
        Email
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="jane@email.com"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
      />

      <View style={styles.badge}>
        <TrustBadge label="We never sell your information" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: space(2) },
  intro: { marginBottom: space(6) },
  label: { marginBottom: space(2), marginTop: space(4) },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    height: 52,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  badge: { marginTop: space(6) },
});
