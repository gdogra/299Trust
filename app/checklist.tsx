import React from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Progress } from "@/components/Progress";
import type { PlanId } from "@/constants/plans";
import { colors, space } from "@/theme/tokens";

// "What you'll need" pre-flight screen. One of the two highest-leverage
// anti-abandonment screens: it sets expectations right before the questionnaire,
// where DIY estate-planning users get anxious and bail.
const ITEMS = [
  "Full legal names of you and your beneficiaries",
  "A rough list of major assets (home, accounts, vehicles)",
  "Who you'd like to make decisions if you can't",
  "About 20–30 minutes (you can pause anytime)",
];

export default function Checklist() {
  const { plan } = useLocalSearchParams<{ plan: PlanId }>();

  return (
    <Screen
      footer={
        <Button
          title="I'm ready — continue"
          onPress={() => router.push({ pathname: "/lead", params: { plan } })}
        />
      }
    >
      <Progress step={1} total={4} />
      <Text variant="h1" style={styles.heading}>
        Here's what you'll need
      </Text>
      <Text variant="bodyMuted" style={styles.intro}>
        Gather these before you start so the questionnaire goes smoothly. Don't
        worry — nothing has to be perfect, and you can change answers later.
      </Text>
      <Card>
        <View style={{ gap: space(4) }}>
          {ITEMS.map((item, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.bullet}>
                <Text style={styles.bulletText}>{i + 1}</Text>
              </View>
              <Text variant="body" style={styles.itemText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: space(2) },
  intro: { marginBottom: space(6) },
  row: { flexDirection: "row", gap: space(4), alignItems: "center" },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.primaryDark },
  itemText: { flex: 1 },
});
