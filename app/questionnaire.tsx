import React, { useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "@/components/Screen";
import { Text } from "@/components/Text";
import { Button } from "@/components/Button";
import { FORMSTACK_FORM_URL, isFormstackConfigured } from "@/constants/config";
import type { PlanId } from "@/constants/plans";
import { useSession } from "@/session/SessionProvider";
import { colors, space } from "@/theme/tokens";

// Embeds the Formstack questionnaire. The session_id is injected as a query
// param so Formstack's hidden field captures it and the webhook can correlate
// the submission back to this app session. Payment + document generation stay
// inside Formstack — we never rebuild them.
export default function Questionnaire() {
  const { plan } = useLocalSearchParams<{ plan: PlanId }>();
  const { sessionId, track } = useSession();
  const lastStep = useRef(0);

  const formUrl = useMemo(() => {
    const u = new URL(FORMSTACK_FORM_URL);
    if (sessionId) u.searchParams.set("session_id", sessionId);
    if (plan) u.searchParams.set("plan", plan);
    return u.toString();
  }, [sessionId, plan]);

  const onNavChange = (nav: WebViewNavigation) => {
    // Coarse progress signal: Formstack multi-page forms change URL/anchor per
    // page. The authoritative completion/payment signal is the webhook.
    lastStep.current += 1;
    track("questionnaire_step_completed", "webview_nav", { url: nav.url });
    if (/thank|complete|confirmation|success/i.test(nav.url)) {
      track("payment_started", "webview_confirmation");
      router.replace({ pathname: "/status", params: { plan } });
    }
  };

  // Placeholder guard: until the real Formstack URL is set, show a clear notice
  // instead of trying to load REPLACE-ME.
  if (!isFormstackConfigured) {
    return (
      <Screen
        footer={
          <Button
            title="Skip to confirmation (demo)"
            onPress={() => router.replace({ pathname: "/status", params: { plan } })}
          />
        }
      >
        <View style={styles.placeholder}>
          <Text variant="h1">Questionnaire</Text>
          <Text variant="bodyMuted" style={styles.pText}>
            The Formstack form isn't connected yet. Set{" "}
            <Text variant="label">EXPO_PUBLIC_FORMSTACK_FORM_URL</Text> to your
            real form URL and this screen will embed it with the session_id and
            plan ({plan}) injected automatically.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <WebView
        source={{ uri: formUrl }}
        onNavigationStateChange={onNavChange}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  placeholder: { flex: 1, justifyContent: "center", gap: space(3) },
  pText: { marginTop: space(2) },
});
