import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/theme/tokens";

// Slim step indicator for the funnel so users always see how far along they are
// — a small but real anti-abandonment cue.
export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.seg, i < step ? styles.on : styles.off]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space(2), marginBottom: space(5) },
  seg: { flex: 1, height: 5, borderRadius: radius.pill },
  on: { backgroundColor: colors.primary },
  off: { backgroundColor: colors.line },
});
