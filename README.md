# 299Trust — Mobile App (V1)

Customer-facing **React Native / Expo** app that wraps the existing 299Trust
DIY revocable living-trust flow. **Formstack stays the source of truth** for the
questionnaire, Stripe payment, and document generation. The backend only
**mirrors funnel state** and **correlates** an app session to a Formstack
submission so we can measure where users enter, abandon, pay, and complete.

No legal documents are stored.

## What's here

```
app/                                # Expo Router screens (the funnel)
  _layout.tsx                       #   fonts + providers + navigation
  index → how-it-works → plans → checklist → lead → questionnaire → status
src/
  theme/tokens.ts                   # brand system (edit here to rebrand)
  components/                       # Screen, Button, Card, Text, Progress, TrustBadge
  session/SessionProvider.tsx       # session mint + offline funnel-event buffer
  api/client.ts                     # typed client for the Edge Functions
  constants/                        # plans, public config
supabase/
  migrations/0001_init.sql          # schema + RLS (default-deny)
  functions/session|event|lead/     # app-facing API
  functions/webhook-receiver/       # Formstack -> Supabase correlation endpoint
  config.toml
.env.example                        # copy to .env; never commit .env
```

## Run the app

```bash
npm install
cp .env.example .env        # fill EXPO_PUBLIC_* (publishable key + Formstack URL)
npm start                   # then press i (iOS) / a (Android), or scan in Expo Go
```

The questionnaire screen shows a clear placeholder until
`EXPO_PUBLIC_FORMSTACK_FORM_URL` points at the real form; once set, it embeds
the form with `session_id` + `plan` injected for correlation.

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

## App-facing API (Edge Functions)

The mobile app talks to these, never to PostgREST directly. Base URL:
`https://fdrdecpzihlztncvglwx.supabase.co/functions/v1/`

| Endpoint | Body | Returns | Notes |
|---|---|---|---|
| `POST /session` | `{device_id?, platform?, app_version?, entry_source?}` | `{session_id}` | Creates a session; auto-logs `app_opened`. |
| `POST /event` | `{session_id, event_type, step?, metadata?}` or `{session_id, events:[...]}` | `{inserted}` | Single or batch. Rejects non-canonical `event_type`. Bumps `last_seen_at`; `session_abandoned` marks the session abandoned. |
| `POST /lead` | `{session_id?, email?, full_name?, phone?, plan_interest?, marketing_optin?}` | `{lead_id}` | Dedupes by email; links session→lead. |

Deploy: `supabase functions deploy session event lead webhook-receiver`

## Admin dashboard (`dashboard/`)

Vite + React funnel dashboard: KPI cards (sessions, leads, paid, conversion),
the step-by-step conversion funnel with drop-off, recent sessions, and an
orphan-submission warning. Reads aggregates from the `admin-metrics` Edge
Function (gated by `ADMIN_API_SECRET`), which queries the read-only views in
`migrations/0002_admin_views.sql`.

```bash
# backend
supabase secrets set ADMIN_API_SECRET=$(openssl rand -hex 24)
supabase functions deploy admin-metrics

# dashboard
cd dashboard && npm install
cp .env.example .env      # set VITE_FUNCTIONS_URL
npm run dev               # enter the ADMIN_API_SECRET at the login screen
```

The admin secret is entered at runtime (localStorage), never baked into the
build. Deploy the static `dashboard/dist` anywhere (Netlify, Vercel, Supabase
hosting). Upgrade to Supabase Auth + an `admin` role before wide exposure.

## Security notes

- `.env` is gitignored. Only the **publishable** key ships in the app;
  `service_role` and the webhook secret live in Supabase function secrets.
- RLS is default-deny on every table. The app talks to Edge Functions, not
  PostgREST directly. Admin read access is added later via an `admin` claim.

### Hardening (before launch)

- App-facing functions run with `verify_jwt = false` and currently accept any
  caller — they only INSERT funnel data, but add **rate limiting** and
  abuse protection (e.g. CAPTCHA on `/lead`) before going live.

## AI-guided intake (V2)

A conversational alternative to the form: `ai-intake` Edge Function chats with
the customer (Anthropic SDK, `claude-opus-4-8` default — override via
`ANTHROPIC_MODEL`), maps answers to Formstack fields via tool use, and persists
them to `ai_conversations` / `ai_answer_mappings`.

**Guardrails (estate-planning stakes are real):**

- The assistant guides intake; it does **not** give legal advice (enforced in
  the system prompt).
- **Human-in-the-loop:** sensitive answers (beneficiaries, trustees, guardians)
  come back flagged `needs_confirmation` and are confirmed in-conversation —
  the AI never finalizes who inherits on its own.
- It does **not** auto-submit to Formstack — Formstack stays the source of
  truth; mappings are staged for a final human-reviewed hand-off.

Field map in `functions/_shared/formstack-map.ts` (placeholder ids — replace
with real ones). In the app, set `EXPO_PUBLIC_AI_INTAKE_ENABLED=true` to expose
the "guided assistant (beta)" entry on the checklist screen.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-intake
```

## Not built yet (next)

- Real Formstack field map + a confirmed-answers → Formstack hand-off for the
  AI intake path.
