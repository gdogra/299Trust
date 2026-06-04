// POST /event — record one or more funnel events (the conversion backbone).
//
// Single:  { session_id, event_type, step?, metadata?, occurred_at? }
// Batch:   { session_id, lead_id?, events: [{ event_type, step?, metadata?,
//            occurred_at? }, ...] }
// Returns: { inserted: <n> }
//
// The app buffers events offline and flushes a batch here, so we never lose
// funnel data to flaky mobile networks. event_type must be in the canonical
// vocabulary (../_shared/events.ts) or the whole request is rejected.

import { adminClient } from "../_shared/supabase.ts";
import { json, corsHeaders } from "../_shared/cors.ts";
import { isFunnelEventType } from "../_shared/events.ts";
import { nowIso, str } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const sessionId = str(body.session_id);
  if (!sessionId) return json({ error: "missing_session_id" }, 422);
  const leadId = str(body.lead_id);

  const incoming = Array.isArray(body.events)
    ? body.events
    : body.event_type
    ? [body]
    : [];
  if (incoming.length === 0) return json({ error: "no_events" }, 422);

  const rows = [];
  for (const e of incoming as Record<string, unknown>[]) {
    if (!isFunnelEventType(e.event_type)) {
      return json({ error: "invalid_event_type", value: e.event_type ?? null }, 422);
    }
    rows.push({
      session_id: sessionId,
      lead_id: leadId,
      event_type: e.event_type,
      step: str(e.step),
      metadata: e.metadata ?? null,
      occurred_at: str(e.occurred_at) ?? nowIso(),
    });
  }

  const admin = adminClient();
  const { error } = await admin.from("funnel_events").insert(rows);
  if (error) return json({ error: "insert_failed" }, 500);

  // Keep the session warm; mark abandoned only if still active (never override
  // a 'converted' session set by the webhook).
  await admin.from("app_sessions").update({ last_seen_at: nowIso() }).eq("id", sessionId);
  if (rows.some((r) => r.event_type === "session_abandoned")) {
    await admin
      .from("app_sessions")
      .update({ status: "abandoned" })
      .eq("id", sessionId)
      .eq("status", "active");
  }

  return json({ inserted: rows.length });
});
