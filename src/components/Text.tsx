import React from "react";
import { Text as RNText, TextProps } from "react-native";
import { type } from "@/theme/tokens";

type Variant = keyof typeof type;

// Typography component bound to brand tokens. Use instead of raw <Text>.
export function Text({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: Variant }) {
  return <RNText {...props} style={[type[variant], style]} />;
}
