import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius, shadow, space } from "@/theme/tokens";

export function Card({
  children,
  onPress,
  selected,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
}) {
  const body = (
    <View
      style={[
        styles.card,
        selected && styles.selected,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(5),
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  selected: { borderColor: colors.primary, borderWidth: 2 },
  pressed: { opacity: 0.9 },
});
