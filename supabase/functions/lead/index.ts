// POST /lead — capture/update a lead and link it to the app session.
//
// Body: { session_id?, email?, full_name?, phone?, plan_interest?,
//         marketing_optin? }   (need at least one of email or session_id)
// Returns: { lead_id }
//
// Dedupes by email (case-insensitive). Updates never clobber existing values
// with nulls (see compact()). Links the session to the lead so the webhook can
// resolve the lead later even before payment.

import { adminClient } from "../_shared/supabase.ts";
import { json, corsHeaders } from "../_shared/cors.ts";
import { compact, str } from "../_shared/util.ts";

const PLANS = ["individual_299", "joint_399"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const email = str(body.email);
  const sessionId = str(body.session_id);
  const planInterest = str(body.plan_interest);

  if (!email && !sessionId) return json({ error: "need_email_or_session" }, 422);
  if (planInterest && !PLANS.includes(planInterest)) {
    return json({ error: "invalid_plan_interest", allowed: PLANS }, 422);
  }

  const admin = adminClient();
  const fields = compact({
    email,
    full_name: str(body.full_name),
    phone: str(body.phone),
    plan_interest: planInterest,
    marketing_optin: body.marketing_optin === true ? true : null,
  });

  let leadId: string | undefined;

  if (email) {
    const { data: existing } = await admin
      .from("leads")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    leadId = existing?.id;
  }

  if (leadId) {
    await admin.from("leads").update(fields).eq("id", leadId);
  } else {
    const { data, error } = await admin
      .from("leads")
      .insert(fields)
      .select("id")
      .single();
    if (error || !data) return json({ error: "create_failed" }, 500);
    leadId = data.id;
  }

  if (sessionId) {
    await admin.from("app_sessions").update({ lead_id: leadId }).eq("id", sessionId);
  }

  return json({ lead_id: leadId });
});
