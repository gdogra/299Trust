# 299Trust — Mobile App Backend (V1)

Customer-facing mobile app that wraps the existing 299Trust DIY revocable
living-trust flow. **Formstack stays the source of truth** for the
questionnaire, Stripe payment, and document generation. This backend only
**mirrors funnel state** and **correlates** an app session to a Formstack
submission so we can measure where users enter, abandon, pay, and complete.

No legal documents are stored.

## What's here

```
supabase/
  migrations/0001_init.sql          # schema + RLS (default-deny)
  functions/webhook-receiver/       # Formstack -> Supabase correlation endpoint
  functions/_shared/cors.ts
  config.toml
.env.example                        # copy to .env; never commit .env
```

## The core idea: session correlation

1. App mints a `session_id` (UUID) on first open.
2. App opens the Formstack form in a WebView with the key prefilled into a
   **hidden field**: `…/forms/<id>?session_id=<uuid>&plan=joint_399`.
3. User completes the form + pays **inside Formstack** (unchanged).
4. Formstack fires a **webhook** (JSON) to `webhook-receiver`, echoing back the
   hidden `session_id`.
5. The function joins submission ↔ session ↔ lead, records payment/doc status,
   emits funnel events, and flips the session to `converted`.

Submissions that arrive without a matchable session are stored as **orphans**
and reconciled by email — expected for users who open the form outside the app.

## Canonical funnel events (`funnel_events.event_type`)

Instrument these everywhere; they ARE the funnel:

`app_opened` → `onboarding_started` → `onboarding_completed` → `plan_viewed`
→ `plan_selected` → `questionnaire_opened` → `questionnaire_step_completed`
→ `payment_started` → `payment_succeeded` → `document_generated`
→ `document_delivered`, plus `session_abandoned`.

## Setup

```bash
# 1. Install the CLI and link (project ref is not a secret)
brew install supabase/tap/supabase
supabase login                       # uses a personal access token, not the DB password
supabase link --project-ref fdrdecpzihlztncvglwx

# 2. Apply the schema
supabase db push

# 3. Set Edge Function secrets (server-side only — never in the app)
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=... \
  FORMSTACK_WEBHOOK_SECRET=$(openssl rand -hex 24)

# 4. Deploy the webhook receiver
supabase functions deploy webhook-receiver
```

Then in Formstack: **Form Settings → Emails & Actions → Advanced Settings →
Add Webhook**, payload **JSON**, URL:

```
https://fdrdecpzihlztncvglwx.supabase.co/functions/v1/webhook-receiver?secret=<FORMSTACK_WEBHOOK_SECRET>
```

## Two things to verify with a real test submission

1. **Does the webhook payload include hidden-field values** (`session_id`,
   `plan`)? If a config quirk strips them, fall back to email matching. The
   field-name guesses in `webhook-receiver/index.ts` (`findSessionId`,
   `pick(...)`) should be tightened to the real payload shape once seen.
2. **Does Stripe payment status arrive in the same webhook or a separate
   event?** Determines whether `payment_status` updates in one call or two.

## Security notes

- `.env` is gitignored. Only the **publishable** key ships in the app;
  `service_role` and the webhook secret live in Supabase function secrets.
- RLS is default-deny on every table. The app talks to Edge Functions, not
  PostgREST directly. Admin read access is added later via an `admin` claim.

## Not built yet (next)

- App-facing Edge Functions: `POST /session`, `POST /event`, `POST /lead`.
- Expo app (onboarding, plan/pricing, WebView, status).
- Admin funnel dashboard.
- V2: AI-guided intake (tables already present: `ai_conversations`,
  `ai_answer_mappings`).
