import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { planById, type PlanId } from "@/constants/plans";
import { useSession } from "@/session/SessionProvider";
import { colors, space } from "@/theme/tokens";

// "What happens next" — the second high-leverage trust screen. Sets clear
// expectations after submission so users don't anxiously wonder what's next.
const NEXT = [
  { title: "We're preparing your documents", body: "Your trust package is being generated now." },
  { title: "Check your email", body: "We'll send your completed documents and signing instructions shortly." },
  { title: "Sign to make it official", body: "Follow the included guide to sign and, where needed, notarize." },
];

export default function Status() {
  const { plan } = useLocalSearchParams<{ plan: PlanId }>();
  const { track } = useSession();
  const planName = plan ? planById(plan).name : "your trust";

  useEffect(() => {
    track("document_generated", "status_screen", { plan });
  }, [track, plan]);

  return (
    <Screen
      footer={
        <Button title="Back to home" onPress={() => router.replace("/")} />
      }
    >
      <View style={styles.check}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text variant="h1" style={styles.heading}>
        You're all set
      </Text>
      <Text variant="bodyMuted" style={styles.intro}>
        Thank you — {planName} is on its way. Here's what happens next.
      </Text>
      <View style={{ gap: space(4) }}>
        {NEXT.map((n, i) => (
          <Card key={i}>
            <Text variant="h2">{n.title}</Text>
            <Text variant="bodyMuted" style={styles.body}>
              {n.body}
            </Text>
          </Card>
        ))}
      </View>
      <Text variant="small" style={styles.support}>
        Questions? Email support@299trust.com — a real person will help.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(4),
  },
  checkMark: { color: colors.onPrimary, fontSize: 30, fontFamily: "Inter_600SemiBold" },
  heading: { marginBottom: space(2) },
  intro: { marginBottom: space(6) },
  body: { marginTop: space(1) },
  support: { marginTop: space(6), textAlign: "center" },
});
