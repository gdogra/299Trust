import Constants from "expo-constants";

// Public runtime config, sourced from app.config.ts `extra` (which reads
// EXPO_PUBLIC_* env vars). No secrets — only the publishable key ships here.
type Extra = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  formstackFormUrl: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

export const SUPABASE_URL = extra.supabaseUrl ?? "";
export const SUPABASE_PUBLISHABLE_KEY = extra.supabasePublishableKey ?? "";
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// PLACEHOLDER — swap for the real Formstack form URL via
// EXPO_PUBLIC_FORMSTACK_FORM_URL. The app appends ?session_id=&plan= so the
// webhook can correlate the submission back to this app session.
export const FORMSTACK_FORM_URL = extra.formstackFormUrl ?? "";

export const isFormstackConfigured = !FORMSTACK_FORM_URL.includes("REPLACE-ME");
