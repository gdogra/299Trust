// 299Trust brand tokens — the single source of truth for the app's look.
// Rebrand by editing this file only. Trust-forward palette: deep evergreen
// (legacy, stability), warm gold (premium), warm paper (approachable, calm).

export const colors = {
  primary: "#13433D", // deep evergreen
  primaryDark: "#0E322E",
  primarySoft: "#E7EEEB",
  accent: "#C9A24B", // warm gold
  accentSoft: "#F3E9CF",
  bg: "#F7F4EE", // warm paper
  surface: "#FFFFFF",
  ink: "#1A1F1D",
  inkMuted: "#5B655F",
  line: "#E4DECF",
  success: "#2E7D5B",
  danger: "#B23A48",
  onPrimary: "#F7F4EE",
} as const;

// 4pt spacing scale.
export const space = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

// Font families map to @expo-google-fonts packages loaded in app/_layout.tsx.
export const fonts = {
  display: "Fraunces_600SemiBold", // serif headlines — the "estate/legacy" feel
  displayBold: "Fraunces_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
} as const;

export const type = {
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, color: colors.ink },
  h1: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink },
  h2: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  bodyMuted: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.inkMuted },
  label: { fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 18, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
} as const;

export const shadow = {
  card: {
    shadowColor: "#1A1F1D",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
} as const;
