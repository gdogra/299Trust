import { ExpoConfig } from "expo/config";

// Brand-forward Expo config. Asset files are intentionally omitted so the app
// runs before icons/splash art exist — Expo falls back to defaults.
const config: ExpoConfig = {
  name: "299Trust",
  slug: "two99trust",
  scheme: "two99trust",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#13433D",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "trust.two99.app",
  },
  android: {
    package: "trust.two99.app",
    adaptiveIcon: { backgroundColor: "#13433D" },
  },
  plugins: ["expo-router", "expo-font"],
  experiments: { typedRoutes: true },
  extra: {
    // Public config. Real values come from EXPO_PUBLIC_* env vars at build time;
    // these are safe defaults / fallbacks. No secrets here.
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ??
      "https://fdrdecpzihlztncvglwx.supabase.co",
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    formstackFormUrl:
      process.env.EXPO_PUBLIC_FORMSTACK_FORM_URL ??
      "https://REPLACE-ME.formstack.com/forms/your_form_id",
  },
};

export default config;
