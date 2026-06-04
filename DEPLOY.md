# 299Trust — Deploy Runbook

End-to-end deploy. Project ref `fdrdecpzihlztncvglwx` (not a secret). All
secrets stay on your machine / in Supabase — never in git.

---

## The SQL you run, in order

Three files. `db push` applies the two **migrations** automatically; **seed is
manual** (it's demo data, not schema).

| Order | File | How it runs |
|---|---|---|
| 1 | `~/Projects/299Trust/supabase/migrations/0001_init.sql` | `supabase db push` (or paste into SQL Editor) |
| 2 | `~/Projects/299Trust/supabase/migrations/0002_admin_views.sql` | `supabase db push` (same command applies both) |
| 3 | `~/Projects/299Trust/supabase/seed.sql` | **manual** — SQL Editor or `supabase db execute` (optional, demo data) |

Two ways to run the migrations — pick one:

- **CLI (recommended):** `supabase db push` applies `0001` then `0002` in order.
- **Dashboard:** Supabase → **SQL Editor** → paste `0001_init.sql`, Run →
  paste `0002_admin_views.sql`, Run. Then paste `seed.sql`, Run.

---

## Step 1 — CLI + link

```bash
brew install supabase/tap/supabase            # if not installed
supabase login                                # personal access token, NOT the DB password
cd ~/Projects/299Trust
supabase link --project-ref fdrdecpzihlztncvglwx
```

## Step 2 — Apply schema

```bash
supabase db push          # applies migrations 0001 + 0002
```

## Step 3 — (optional) Seed demo data for the dashboard

```bash
supabase db execute --file supabase/seed.sql
# or paste supabase/seed.sql into the Supabase SQL Editor and Run
```

Verify: `SELECT * FROM v_funnel_totals;` → ~120 sessions, 28 paid, 2 orphans.

## Step 4 — Edge Function secrets (server-side only)

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=<current service_role key from Dashboard → API> \
  FORMSTACK_WEBHOOK_SECRET=$(openssl rand -hex 24) \
  ADMIN_API_SECRET=$(openssl rand -hex 24) \
  ANTHROPIC_API_KEY=<sk-ant-... only if enabling AI intake>
```

Note the `FORMSTACK_WEBHOOK_SECRET` and `ADMIN_API_SECRET` values — you'll need
them in Steps 6 and 8.

## Step 5 — Deploy functions

```bash
supabase functions deploy session event lead webhook-receiver admin-metrics ai-intake
```

Base URL: `https://fdrdecpzihlztncvglwx.supabase.co/functions/v1/`

## Step 6 — Wire the Formstack webhook

Formstack → **Form Settings → Emails & Actions → Advanced Settings → Add
Webhook**, payload **JSON**, URL:

```
https://fdrdecpzihlztncvglwx.supabase.co/functions/v1/webhook-receiver?secret=<FORMSTACK_WEBHOOK_SECRET>
```

Add a **hidden field** named `session_id` (and one named `plan`). Submit one
test entry, then check `formstack_submissions` — confirm the payload carried the
hidden fields, and tighten the field-name guesses in
`functions/_shared/*` / `webhook-receiver` if needed.

## Step 7 — Run the app

```bash
cd ~/Projects/299Trust
cp .env.example .env       # fill the EXPO_PUBLIC_* values:
#   EXPO_PUBLIC_SUPABASE_URL=https://fdrdecpzihlztncvglwx.supabase.co
#   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#   EXPO_PUBLIC_FORMSTACK_FORM_URL=https://<acct>.formstack.com/forms/<id>
#   EXPO_PUBLIC_AI_INTAKE_ENABLED=false      # true to expose the guided assistant
npm install
npm start                  # press i / a, or scan with Expo Go
```

## Step 8 — Run the admin dashboard

```bash
cd ~/Projects/299Trust/dashboard
cp .env.example .env       # VITE_FUNCTIONS_URL=https://fdrdecpzihlztncvglwx.supabase.co/functions/v1
npm install
npm run dev                # open the URL, enter ADMIN_API_SECRET at the login
```

With the seed loaded you'll see the populated funnel, KPIs, recent sessions, and
the orphan-submission warning. Deploy `dashboard/dist` (Step: `npm run build`)
to any static host when ready.

---

## Before public launch

- **Rate-limit** the app-facing functions (`session`/`event`/`lead`) — they run
  `verify_jwt = false` and currently accept any caller.
- Replace the **placeholder Formstack field map**
  (`functions/_shared/formstack-map.ts`) with real field ids.
- Remove the seed data: re-running `seed.sql`'s delete header, or
  `DELETE FROM ...` the `seed-%` rows.
- Upgrade the admin dashboard from a shared secret to Supabase Auth + an
  `admin` role.
