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
// shape varies by account/config, so we look in the common places (top level +
// known nested containers) rather than assuming one exact schema. The diagnose()
// helper makes the FIRST test submission self-documenting — see the audit log.
// ---------------------------------------------------------------------------
type AnyObj = Record<string, unknown>;

// Candidate keys per logical field. Reused for both extraction and diagnostics,
// so the audit log tells us exactly which key matched (or that none did).
const KEY_CANDIDATES: Record<string, string[]> = {
  submission_id: ["UniqueID", "unique_id", "submission_id", "id"],
  form_id: ["FormID", "form_id", "form"],
  session_id: ["session_id", "sessionId"],
  plan: ["plan"],
  email: ["email", "Email"],
  payment_status: ["payment_status", "PaymentStatus", "payment", "transaction_status"],
  amount: ["amount_cents", "amount", "total", "payment_amount"],
  stripe_charge_id: ["stripe_charge_id", "charge_id", "transaction_id"],
};

// Formstack may nest the field map under one of these.
const CONTAINER_KEYS = ["data", "fields", "FormData"];

function containersOf(payload: AnyObj): AnyObj[] {
  return CONTAINER_KEYS.map((k) => payload[k]).filter(
    (c): c is AnyObj => !!c && typeof c === "object",
  );
}

function pick(obj: AnyObj, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

// Search top level + nested containers for the first matching value.
function pickDeep(payload: AnyObj, keys: string[]): string | undefined {
  for (const scope of [payload, ...containersOf(payload)]) {
    const v = pick(scope, keys);
    if (v !== undefined) return v;
  }
  return undefined;
}

// Which candidate key actually carried a value (key NAME only — no PII value).
function firstKey(payload: AnyObj, keys: string[]): string | null {
  for (const scope of [payload, ...containersOf(payload)]) {
    for (const k of keys) {
      const v = scope[k];
      if ((typeof v === "string" && v.trim() !== "") || typeof v === "number") return k;
    }
  }
  return null;
}

// Self-documenting payload shape: top-level key names, nested container key
// names, and which candidate key each logical field resolved from. Contains NO
// field values (no PII) — safe to store in audit_logs. After the first test
// submission, `resolvedFrom.payment_status === null` immediately tells us the
// real Stripe status key isn't in our candidate list yet.
function diagnose(payload: AnyObj) {
  const resolvedFrom: Record<string, string | null> = {};
  for (const [field, cands] of Object.entries(KEY_CANDIDATES)) {
    resolvedFrom[field] = firstKey(payload, cands);
  }
  const containerKeys: Record<string, string[]> = {};
  for (const k of CONTAINER_KEYS) {
    const c = payload[k];
    if (c && typeof c === "object") containerKeys[k] = Object.keys(c as AnyObj);
  }
  return { topLevelKeys: Object.keys(payload), containerKeys, resolvedFrom };
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

  // Self-documenting shape (key names only) — surfaced in every audit log so the
  // first real submission reveals the exact field names without DB spelunking.
  const shape = diagnose(payload);

  const formstackSubmissionId = pickDeep(payload, KEY_CANDIDATES.submission_id);
  if (!formstackSubmissionId) {
    // We can't dedupe without an id; store nothing mutable, just audit it
    // (full payload here, since this is the case we most need to debug).
    await admin.from("audit_logs").insert({
      actor_type: "webhook",
      action: "webhook_missing_submission_id",
      entity: "formstack_submissions",
      metadata: { payload_shape: shape, payload },
    });
    return json({ error: "missing_submission_id", payload_shape: shape }, 422);
  }

  const sessionId = pickDeep(payload, KEY_CANDIDATES.session_id);
  const formId = pickDeep(payload, KEY_CANDIDATES.form_id);
  const plan = pickDeep(payload, KEY_CANDIDATES.plan); // hidden field, app-prefilled
  const email = pickDeep(payload, KEY_CANDIDATES.email);
  const paymentStatus = mapPaymentStatus(pickDeep(payload, KEY_CANDIDATES.payment_status));
  const amount = pickDeep(payload, KEY_CANDIDATES.amount);
  const stripeChargeId = pickDeep(payload, KEY_CANDIDATES.stripe_charge_id);

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
    metadata: {
      formstackSubmissionId,
      sessionId,
      leadId,
      paymentStatus,
      isOrphan,
      payload_shape: shape, // key names + resolvedFrom map (no PII)
    },
  });

  return json({ ok: true, correlated: !isOrphan, orphan: isOrphan, payload_shape: shape });
});
