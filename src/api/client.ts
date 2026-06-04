// Thin client for the 299Trust Edge Functions. The app NEVER touches PostgREST
// directly — it goes through these endpoints (see supabase/functions/*).

import {
  FUNCTIONS_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from "@/constants/config";
import type { PlanId } from "@/constants/plans";

export type FunnelEventType =
  | "app_opened"
  | "onboarding_started"
  | "onboarding_completed"
  | "plan_viewed"
  | "plan_selected"
  | "questionnaire_opened"
  | "questionnaire_step_completed"
  | "payment_started"
  | "payment_succeeded"
  | "document_generated"
  | "document_delivered"
  | "session_abandoned";

export interface FunnelEvent {
  event_type: FunnelEventType;
  step?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Publishable key is public; it identifies the project, not the user.
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export const api = {
  createSession(input: {
    device_id?: string;
    platform?: "ios" | "android";
    app_version?: string;
    entry_source?: string;
  }) {
    return post<{ session_id: string }>("session", input);
  },

  trackEvents(session_id: string, events: FunnelEvent[], lead_id?: string) {
    return post<{ inserted: number }>("event", { session_id, lead_id, events });
  },

  saveLead(input: {
    session_id?: string;
    email?: string;
    full_name?: string;
    phone?: string;
    plan_interest?: PlanId;
    marketing_optin?: boolean;
  }) {
    return post<{ lead_id: string }>("lead", input);
  },
};
