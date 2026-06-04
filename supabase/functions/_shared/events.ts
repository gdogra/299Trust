// Canonical funnel event vocabulary. The app emits ONLY these; the /event
// function rejects anything else so the funnel stays clean and queryable.
export const FUNNEL_EVENT_TYPES = [
  "app_opened",
  "onboarding_started",
  "onboarding_completed",
  "plan_viewed",
  "plan_selected",
  "questionnaire_opened",
  "questionnaire_step_completed",
  "payment_started",
  "payment_succeeded",
  "document_generated",
  "document_delivered",
  "session_abandoned",
] as const;

export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export function isFunnelEventType(v: unknown): v is FunnelEventType {
  return typeof v === "string" &&
    (FUNNEL_EVENT_TYPES as readonly string[]).includes(v);
}
