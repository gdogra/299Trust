import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { TrustBadge } from "@/components/TrustBadge";
import { useSession } from "@/session/SessionProvider";
import { colors, space } from "@/theme/tokens";

export default function Welcome() {
  const { track } = useSession();

  useEffect(() => {
    track("onboarding_started", "welcome");
  }, [track]);

  return (
    <Screen
      footer={
        <View style={{ gap: space(3) }}>
          <Button
            title="Get started"
            onPress={() => {
              track("plan_viewed", "welcome_cta");
              router.push("/how-it-works");
            }}
          />
          <Text variant="small" style={styles.legal}>
            299Trust provides self-help document preparation, not legal advice.
          </Text>
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>299</Text>
        </View>
        <Text variant="display" style={styles.title}>
          A living trust, without the law firm.
        </Text>
        <Text variant="bodyMuted" style={styles.sub}>
          Protect your family and your home with a complete revocable living
          trust — guided step by step, completed from your phone.
        </Text>
        <View style={styles.badges}>
          <TrustBadge label="Estate-planning documents" />
          <TrustBadge label="Flat $299 — no hourly fees" />
          <TrustBadge label="Your information stays private" />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: "center", gap: space(4) },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(2),
  },
  markText: { color: colors.accent, fontSize: 24, fontFamily: "Fraunces_700Bold" },
  title: { fontSize: 38, lineHeight: 44 },
  sub: { fontSize: 17, lineHeight: 26 },
  badges: { gap: space(2), marginTop: space(3) },
  legal: { textAlign: "center" },
});
