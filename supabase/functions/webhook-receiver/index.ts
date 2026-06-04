// Formstack -> Supabase webhook receiver (Deno / Supabase Edge Function).
//
// Responsibilities:
//   1. Authenticate the caller (shared secret). NEVER trust an open endpoint
//      that mutates payment status.
//   2. Parse the Formstack submission (JSON payload configured in Formstack).
//   3. Read back our correlation key (session_id) from the hidden field and
//      join the submission to app_sessions / leads.
//   4. Upsert formstack_submissions idempotently (keyed on the unique
//      formstack_submission_id) so retried webhooks don't double-count.
//   5. Emit funnel_events, flip the session to 'converted', write an audit_log.
//
// All secrets come from env (Supabase function secrets). Nothing is hardcoded.
//
// Required env:
//   SUPABASE_URL                - project URL
//   SUPABASE_SERVICE_ROLE_KEY   - service role key (bypasses RLS)
//   FORMSTACK_WEBHOOK_SECRET    - shared secret we configure in the webhook URL

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("FORMSTACK_WEBHOOK_SECRET")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers to read fields out of a Formstack payload. Formstack's webhook body
// shape varies by account/config, so we look in the common places rather than
// assuming one exact schema. Verify the real shape against a test submission
// and tighten these once known.
// ---------------------------------------------------------------------------
type AnyObj = Record<string, unknown>;

function pick(obj: AnyObj, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

// Hidden fields may arrive top-level, under `data`, or as a flat field map.
// Search broadly for a `session_id`-looking value.
function findSessionId(payload: AnyObj): string | undefined {
  const direct = pick(payload, ["session_id", "sessionId"]);
  if (direct) return direct;

  const containers = [payload["data"], payload["fields"], payload["FormData"]]
    .filter((c): c is AnyObj => !!c && typeof c === "object");
  for (const c of containers) {
    const v = pick(c as AnyObj, ["session_id", "sessionId"]);
    if (v) return v;
  }
  return undefined;
}

function mapPaymentStatus(raw?: string): "unpaid" | "paid" | "failed" | "refunded" {
  const s = (raw ?? "").toLowerCase();
  if (["paid", "succeeded", "complete", "completed", "success"].includes(s)) return "paid";
  if (["failed", "declined", "error"].includes(s)) return "failed";
  if (["refunded", "refund"].includes(s)) return "refunded";
  return "unpaid";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. Authenticate. Accept the secret via header or ?secret= query param,
  //    since Formstack's webhook URL is the easiest place to attach it.
  const url = new URL(req.url);
  const provided =
    req.headers.get("x-webhook-secret") ?? url.searchParams.get("secret") ?? "";
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  // 2. Parse body (JSON or urlencoded, depending on Formstack webhook config).
  let payload: AnyObj;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    }
  } catch (_e) {
    return json({ error: "bad_payload" }, 400);
  }

  const formstackSubmissionId = pick(payload, [
    "UniqueID", "unique_id", "submission_id", "id",
  ]);
  if (!formstackSubmissionId) {
    // We can't dedupe without an id; store nothing mutable, just audit it.
    await admin.from("audit_logs").insert({
      actor_type: "webhook",
      action: "webhook_missing_submission_id",
      entity: "formstack_submissions",
      metadata: { payload },
    });
    return json({ error: "missing_submission_id" }, 422);
  }

  const sessionId = findSessionId(payload);
  const formId = pick(payload, ["FormID", "form_id", "form"]);
  const plan = pick(payload, ["plan"]); // hidden field, prefilled by the app
  const email = pick(payload, ["email", "Email"]);
  const paymentStatus = mapPaymentStatus(pick(payload, ["payment_status", "PaymentStatus"]));
  const amount = pick(payload, ["amount_cents", "amount"]);
  const stripeChargeId = pick(payload, ["stripe_charge_id", "charge_id"]);

  // 3. Resolve the lead (by linked session, else by email; create if neither).
  let leadId: string | undefined;
  let sessionExists = false;

  if (sessionId) {
    const { data: sess } = await admin
      .from("app_sessions")
      .select("id, lead_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sess) {
      sessionExists = true;
      leadId = sess.lead_id ?? undefined;
    }
  }
  if (!leadId && email) {
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    leadId = lead?.id;
  }
  if (!leadId && email) {
    const { data: created } = await admin
      .from("leads")
      .insert({ email, plan_interest: plan ?? null })
      .select("id")
      .single();
    leadId = created?.id;
  }

  const isOrphan = !sessionExists; // arrived without a matchable app session

  // 4. Idempotent upsert on the unique formstack_submission_id.
  const { error: upsertErr } = await admin
    .from("formstack_submissions")
    .upsert(
      {
        formstack_submission_id: formstackSubmissionId,
        session_id: sessionExists ? sessionId : null,
        lead_id: leadId ?? null,
        formstack_form_id: formId ?? null,
        plan: plan ?? null,
        payment_status: paymentStatus,
        amount_cents: amount ? Number(amount) : null,
        stripe_charge_id: stripeChargeId ?? null,
        document_status: paymentStatus === "paid" ? "generated" : "pending",
        submitted_at: new Date().toISOString(),
        raw_payload: payload,
      },
      { onConflict: "formstack_submission_id" },
    );

  if (upsertErr) {
    await admin.from("audit_logs").insert({
      actor_type: "webhook",
      action: "submission_upsert_failed",
      entity: "formstack_submissions",
      metadata: { error: upsertErr.message, formstackSubmissionId },
    });
    return json({ error: "persist_failed" }, 500);
  }

  // 5. Emit funnel events + flip session, but only when correlated.
  if (sessionExists && sessionId) {
    const events = [
      { session_id: sessionId, lead_id: leadId ?? null, event_type: "questionnaire_step_completed", step: "submitted" },
    ];
    if (paymentStatus === "paid") {
      events.push(
        { session_id: sessionId, lead_id: leadId ?? null, event_type: "payment_succeeded", step: "payment" },
        { session_id: sessionId, lead_id: leadId ?? null, event_type: "document_generated", step: "document" },
      );
      await admin.from("app_sessions").update({ status: "converted", last_seen_at: new Date().toISOString() }).eq("id", sessionId);
    }
    await admin.from("funnel_events").insert(events);
  }

  await admin.from("audit_logs").insert({
    actor_type: "webhook",
    action: isOrphan ? "submission_received_orphan" : "submission_received",
    entity: "formstack_submissions",
    metadata: { formstackSubmissionId, sessionId, leadId, paymentStatus, isOrphan },
  });

  return json({ ok: true, correlated: !isOrphan, orphan: isOrphan });
});
