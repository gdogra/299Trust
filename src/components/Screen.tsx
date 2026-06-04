import React from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space } from "@/theme/tokens";

// Page wrapper: warm-paper background, safe areas, optional scroll, and a
// pinned footer slot for the primary CTA.
export function Screen({
  children,
  footer,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Body
        style={styles.flex}
        contentContainerStyle={[scroll ? styles.scroll : styles.flex, contentStyle]}
      >
        {children}
      </Body>
      {footer ? (
        <SafeAreaView edges={["bottom"]} style={styles.footer}>
          {footer}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: space(6), paddingBottom: space(10) },
  footer: {
    paddingHorizontal: space(6),
    paddingTop: space(3),
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
