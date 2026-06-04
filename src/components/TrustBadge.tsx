import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

// Small reassurance chips used throughout the funnel (e.g. "Attorney-reviewed
// documents", "Your data is encrypted") to build confidence at decision points.
export function TrustBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <View style={styles.dot} />
      <Text variant="small" style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(2),
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: space(1.5),
    paddingHorizontal: space(3),
    alignSelf: "flex-start",
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  text: { color: colors.primaryDark },
});
