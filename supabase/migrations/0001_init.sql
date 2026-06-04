-- 299Trust V1 — initial schema
-- Source of truth for legal docs + payment remains Formstack. This DB mirrors
-- funnel state and correlates an app session to a Formstack submission.
-- No legal documents are stored. All timestamps are UTC.

-- gen_random_uuid() lives in pgcrypto on older PG; harmless if already present.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- leads: a person. Not "users" yet — V1 may have no auth.
-- ---------------------------------------------------------------------------
create table leads (
  id              uuid primary key default gen_random_uuid(),
  email           text,
  full_name       text,
  phone           text,
  plan_interest   text check (plan_interest in ('individual_299', 'joint_399')),
  marketing_optin boolean not null default false,
  created_at      timestamptz not null default now()
);
create index leads_email_idx on leads (lower(email));

-- ---------------------------------------------------------------------------
-- app_sessions: a device/app session. Created on first open, before any PII.
-- ---------------------------------------------------------------------------
create table app_sessions (
  id           uuid primary key default gen_random_uuid(),
  device_id    text,                       -- stable per-install anonymous id
  platform     text check (platform in ('ios', 'android')),
  app_version  text,
  lead_id      uuid references leads (id), -- linked once we know who they are
  entry_source text,                       -- 'organic' | 'ad' | utm_source...
  status       text not null default 'active'
                 check (status in ('active', 'abandoned', 'converted')),
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index app_sessions_lead_idx on app_sessions (lead_id);
create index app_sessions_status_idx on app_sessions (status);

-- ---------------------------------------------------------------------------
-- formstack_submissions: mirror/pointer to a Formstack submission. NOT truth.
-- ---------------------------------------------------------------------------
create table formstack_submissions (
  id                      uuid primary key default gen_random_uuid(),
  session_id              uuid references app_sessions (id),
  lead_id                 uuid references leads (id),
  formstack_form_id       text,
  formstack_submission_id text unique,      -- echoed back via webhook; idempotency key
  plan                    text check (plan in ('individual_299', 'joint_399')),
  payment_status          text not null default 'unpaid'
                            check (payment_status in ('unpaid','paid','failed','refunded')),
  amount_cents            integer,
  stripe_charge_id        text,             -- reference only; Stripe lives in Formstack
  document_status         text not null default 'pending'
                            check (document_status in ('pending','generated','delivered')),
  submitted_at            timestamptz,
  raw_payload             jsonb,            -- full webhook body for audit/replay
  created_at              timestamptz not null default now()
);
create index formstack_submissions_session_idx on formstack_submissions (session_id);
create index formstack_submissions_lead_idx on formstack_submissions (lead_id);

-- ---------------------------------------------------------------------------
-- funnel_events: the conversion analytics backbone (append-only event stream).
-- ---------------------------------------------------------------------------
create table funnel_events (
  id          bigint generated always as identity primary key,
  session_id  uuid references app_sessions (id),
  lead_id     uuid references leads (id),
  event_type  text not null,   -- canonical list documented in README
  step        text,            -- e.g. 'plan_selection', 'questionnaire_q3'
  metadata    jsonb,
  occurred_at timestamptz not null default now()
);
create index funnel_events_type_time_idx on funnel_events (event_type, occurred_at);
create index funnel_events_session_idx on funnel_events (session_id);

-- ---------------------------------------------------------------------------
-- ai_conversations: V2-ready, unused in V1.
-- ---------------------------------------------------------------------------
create table ai_conversations (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references app_sessions (id),
  lead_id      uuid references leads (id),
  model        text,
  status       text not null default 'in_progress'
                 check (status in ('in_progress','completed','abandoned')),
  transcript   jsonb,          -- message array
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- ai_answer_mappings: how AI answers map to Formstack fields. V2-ready.
-- ---------------------------------------------------------------------------
create table ai_answer_mappings (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid references ai_conversations (id),
  formstack_field_id text,
  question_label     text,
  answer_value       jsonb,
  confidence         numeric check (confidence >= 0 and confidence <= 1),
  confirmed_by_user  boolean not null default false,
  created_at         timestamptz not null default now()
);
create index ai_answer_mappings_conversation_idx on ai_answer_mappings (conversation_id);

-- ---------------------------------------------------------------------------
-- audit_logs: tamper-evident trail for sensitive actions.
-- ---------------------------------------------------------------------------
create table audit_logs (
  id          bigint generated always as identity primary key,
  actor_type  text check (actor_type in ('system','admin','webhook')),
  actor_id    text,
  action      text not null,
  entity      text,            -- table name
  entity_id   uuid,
  metadata    jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Default-deny on every table. Writes happen only via the service_role key
-- (Edge Functions), which bypasses RLS. The anon/publishable key gets NO
-- direct table access in V1 — the app talks to Edge Functions, not PostgREST.
-- Admin read access is added later via an authenticated 'admin' claim.
-- ---------------------------------------------------------------------------
alter table leads                  enable row level security;
alter table app_sessions           enable row level security;
alter table formstack_submissions  enable row level security;
alter table funnel_events          enable row level security;
alter table ai_conversations       enable row level security;
alter table ai_answer_mappings     enable row level security;
alter table audit_logs             enable row level security;

-- No policies created => default deny for anon/authenticated.
-- service_role bypasses RLS, so Edge Functions retain full access.
