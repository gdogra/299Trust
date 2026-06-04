import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PLANS, type PlanId } from "@/constants/plans";
import { useSession } from "@/session/SessionProvider";
import { colors, space } from "@/theme/tokens";

export default function Plans() {
  const { track } = useSession();
  const [selected, setSelected] = useState<PlanId | null>(null);

  useEffect(() => {
    track("plan_viewed", "plans_screen");
  }, [track]);

  const onContinue = () => {
    if (!selected) return;
    track("plan_selected", "plans_screen", { plan: selected });
    router.push({ pathname: "/checklist", params: { plan: selected } });
  };

  return (
    <Screen
      footer={
        <Button title="Continue" onPress={onContinue} disabled={!selected} />
      }
    >
      <Text variant="h1" style={styles.heading}>
        Choose your plan
      </Text>
      <Text variant="bodyMuted" style={styles.intro}>
        One flat price. Everything included. No hourly billing, ever.
      </Text>
      <View style={{ gap: space(4) }}>
        {PLANS.map((plan) => {
          const isSel = selected === plan.id;
          return (
            <Card key={plan.id} selected={isSel} onPress={() => setSelected(plan.id)}>
              <View style={styles.head}>
                <View>
                  <Text variant="small" style={styles.forWho}>
                    {plan.forWho.toUpperCase()}
                  </Text>
                  <Text variant="h2">{plan.name}</Text>
                </View>
                <Text style={styles.price}>{plan.price}</Text>
              </View>
              <Text variant="bodyMuted" style={styles.tagline}>
                {plan.tagline}
              </Text>
              <View style={styles.features}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <View style={styles.check} />
                    <Text variant="body">{f}</Text>
                  </View>
                ))}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: space(2) },
  intro: { marginBottom: space(6) },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  forWho: { color: colors.accent, letterSpacing: 1 },
  price: { fontFamily: "Fraunces_700Bold", fontSize: 28, color: colors.primary },
  tagline: { marginTop: space(2) },
  features: { marginTop: space(4), gap: space(2) },
  featureRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  check: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
});
