// POST /session — create an app session (called on first app open).
//
// Body (all optional): { device_id, platform, app_version, entry_source }
// Returns: { session_id }
//
// Also logs the first `app_opened` funnel event so every session has an entry
// point. verify_jwt is disabled (see config.toml) because the app authenticates
// with the publishable key, which is not a JWT under the new key format.
// These endpoints only INSERT low-risk funnel data; add rate limiting before
// launch (see README "Hardening").

import { adminClient } from "../_shared/supabase.ts";
import { json, corsHeaders } from "../_shared/cors.ts";
import { str } from "../_shared/util.ts";

const PLATFORMS = ["ios", "android"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const platform = str(body.platform);
  if (platform && !PLATFORMS.includes(platform)) {
    return json({ error: "invalid_platform", allowed: PLATFORMS }, 422);
  }

  const admin = adminClient();
  const { data, error } = await admin
    .from("app_sessions")
    .insert({
      device_id: str(body.device_id),
      platform,
      app_version: str(body.app_version),
      entry_source: str(body.entry_source),
    })
    .select("id")
    .single();

  if (error || !data) return json({ error: "create_failed" }, 500);

  await admin.from("funnel_events").insert({
    session_id: data.id,
    event_type: "app_opened",
    step: "app_open",
  });

  return json({ session_id: data.id });
});
