import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useSession } from "@/session/SessionProvider";
import { colors, space } from "@/theme/tokens";

const STEPS = [
  {
    n: "1",
    title: "Answer simple questions",
    body: "We ask about your family, home, and wishes in plain language — no legal jargon.",
  },
  {
    n: "2",
    title: "We prepare your documents",
    body: "Your answers generate a complete, ready-to-sign trust package tailored to you.",
  },
  {
    n: "3",
    title: "Sign and protect your family",
    body: "Download, print, and sign. We guide you through making it official.",
  },
];

export default function HowItWorks() {
  const { track } = useSession();

  useEffect(() => {
    track("onboarding_completed", "how_it_works_viewed");
  }, [track]);

  return (
    <Screen
      footer={
        <Button
          title="See plans"
          onPress={() => router.push("/plans")}
        />
      }
    >
      <Text variant="h1" style={styles.heading}>
        Three steps to peace of mind
      </Text>
      <Text variant="bodyMuted" style={styles.intro}>
        Most people finish in under 30 minutes. You can pause and pick up right
        where you left off.
      </Text>
      <View style={{ gap: space(4) }}>
        {STEPS.map((s) => (
          <Card key={s.n}>
            <View style={styles.row}>
              <View style={styles.num}>
                <Text style={styles.numText}>{s.n}</Text>
              </View>
              <View style={styles.copy}>
                <Text variant="h2">{s.title}</Text>
                <Text variant="bodyMuted" style={styles.body}>
                  {s.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: space(2) },
  intro: { marginBottom: space(6) },
  row: { flexDirection: "row", gap: space(4), alignItems: "flex-start" },
  num: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: { fontFamily: "Fraunces_700Bold", fontSize: 18, color: colors.primaryDark },
  copy: { flex: 1, gap: space(1) },
  body: { marginTop: space(1) },
});
