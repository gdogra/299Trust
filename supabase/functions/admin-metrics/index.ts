// GET/POST /admin-metrics — funnel analytics for the admin dashboard.
//
// Auth: shared admin secret via `x-admin-secret` header or ?secret=. This is an
// internal tool; upgrade to Supabase Auth + an `admin` role before exposing it
// widely (see README "Hardening").
//
// Returns: { totals, funnel: [{step,label,sessions,pctOfStart,dropFromPrev}],
//            recentSessions }

import { adminClient } from "../_shared/supabase.ts";
import { json, corsHeaders } from "../_shared/cors.ts";
import { FUNNEL_EVENT_TYPES } from "../_shared/events.ts";

const ADMIN_SECRET = Deno.env.get("ADMIN_API_SECRET")!;

const STEP_LABELS: Record<string, string> = {
  app_opened: "App opened",
  onboarding_started: "Onboarding started",
  onboarding_completed: "Onboarding completed",
  plan_viewed: "Plan viewed",
  plan_selected: "Plan selected",
  questionnaire_opened: "Questionnaire opened",
  questionnaire_step_completed: "Questionnaire progressed",
  payment_started: "Payment started",
  payment_succeeded: "Payment succeeded",
  document_generated: "Document generated",
  document_delivered: "Document delivered",
};

// The funnel order, excluding the non-linear `session_abandoned` marker.
const ORDER = FUNNEL_EVENT_TYPES.filter((t) => t !== "session_abandoned");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const provided =
    req.headers.get("x-admin-secret") ?? url.searchParams.get("secret") ?? "";
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = adminClient();

  const [{ data: totals }, { data: stepRows }, { data: recent }] = await Promise.all([
    admin.from("v_funnel_totals").select("*").single(),
    admin.from("v_funnel_step_counts").select("*"),
    admin
      .from("app_sessions")
      .select("id, platform, status, entry_source, started_at, last_seen_at, lead_id")
      .order("started_at", { ascending: false })
      .limit(25),
  ]);

  const counts = new Map<string, number>(
    (stepRows ?? []).map((r) => [r.event_type as string, Number(r.sessions)]),
  );
  const start = counts.get("app_opened") ?? totals?.total_sessions ?? 0;

  let prev = start;
  const funnel = ORDER.map((step) => {
    const sessions = counts.get(step) ?? 0;
    const pctOfStart = start > 0 ? Math.round((sessions / start) * 100) : 0;
    const dropFromPrev = prev > 0 ? Math.round((1 - sessions / prev) * 100) : 0;
    prev = sessions;
    return { step, label: STEP_LABELS[step] ?? step, sessions, pctOfStart, dropFromPrev };
  });

  return json({ totals, funnel, recentSessions: recent ?? [] });
});
