-- 299Trust — demo seed data for the admin dashboard.
-- Safe to re-run: it deletes its own prior seed rows first (everything keyed by
-- 'seed-...'). Does NOT touch real data. NOT applied by `supabase db push` —
-- run it manually (Supabase SQL Editor, or `supabase db execute`).
--
-- Produces a realistic, monotonic funnel of 120 sessions: all open the app,
-- fewer reach each subsequent step, 28 pay. Plus a few orphan submissions.

-- 1) Clean any previous seed run (children first for FKs).
delete from funnel_events
  where session_id in (select id from app_sessions where device_id like 'seed-device-%');
delete from formstack_submissions
  where session_id in (select id from app_sessions where device_id like 'seed-device-%')
     or formstack_submission_id like 'seed-%';
delete from app_sessions where device_id like 'seed-device-%';
delete from leads where email like 'seed+%@seed.test';

-- 2) Stage 120 sessions with a funnel-shaped "reached" depth.
--    reached(n) = how many of the 11 funnel steps this session completed.
--    The threshold array sets exactly how many sessions reach each step:
--    step1=120 (all) ... step9=36 (paid-ish) ... step11=28 (delivered).
create temporary table _seed as
select
  n,
  (select count(*) from unnest(array[120,110,102,95,80,68,55,44,36,31,28]) t where t >= n) as reached,
  gen_random_uuid() as sid,
  now() - ((150 - n) || ' hours')::interval as started_at
from generate_series(1, 120) n;

-- 3) Sessions (status derived from how far they got).
insert into app_sessions (id, device_id, platform, app_version, entry_source, status, started_at, last_seen_at)
select
  sid,
  'seed-device-' || n,
  case when n % 2 = 0 then 'ios' else 'android' end,
  '1.0.0',
  (array['organic','google_ads','referral','organic','facebook_ads'])[1 + (n % 5)],
  case when reached >= 9 then 'converted' when reached <= 5 then 'abandoned' else 'active' end,
  started_at,
  started_at + interval '20 minutes'
from _seed;

-- 4) Funnel events: one per completed step, in canonical order.
insert into funnel_events (session_id, event_type, step, occurred_at)
select s.sid, sn.name, 'seed', s.started_at + (sn.idx || ' minutes')::interval
from _seed s
join (values
  (1,'app_opened'),(2,'onboarding_started'),(3,'onboarding_completed'),
  (4,'plan_viewed'),(5,'plan_selected'),(6,'questionnaire_opened'),
  (7,'questionnaire_step_completed'),(8,'payment_started'),(9,'payment_succeeded'),
  (10,'document_generated'),(11,'document_delivered')
) as sn(idx, name) on sn.idx <= s.reached;

-- Abandonment marker for sessions that dropped early.
insert into funnel_events (session_id, event_type, step, occurred_at)
select sid, 'session_abandoned', 'drop', started_at + interval '25 minutes'
from _seed where reached <= 5;

-- 5) Leads for sessions that got as far as lead capture (reached >= 6).
insert into leads (email, full_name, plan_interest, created_at)
select 'seed+' || n || '@seed.test', 'Seed User ' || n,
  case when n % 2 = 0 then 'joint_399' else 'individual_299' end,
  started_at
from _seed where reached >= 6;

-- Link each session to its lead (match on the encoded n).
update app_sessions a set lead_id = l.id
from leads l
where a.device_id like 'seed-device-%'
  and l.email = 'seed+' || split_part(a.device_id, '-', 3) || '@seed.test';

-- 6) Paid submissions for sessions that reached payment_succeeded (reached >= 9).
insert into formstack_submissions
  (session_id, lead_id, formstack_form_id, formstack_submission_id, plan,
   payment_status, amount_cents, document_status, submitted_at)
select
  s.sid, a.lead_id, 'seed_form', 'seed-sub-' || s.n,
  case when s.n % 2 = 0 then 'joint_399' else 'individual_299' end,
  'paid',
  case when s.n % 2 = 0 then 39900 else 29900 end,
  case when s.reached >= 11 then 'delivered' when s.reached >= 10 then 'generated' else 'pending' end,
  s.started_at + interval '30 minutes'
from _seed s
join app_sessions a on a.id = s.sid
where s.reached >= 9;

-- 7) Two orphan submissions (arrived without a matchable session) to exercise
--    the dashboard's reconciliation warning.
insert into formstack_submissions
  (session_id, formstack_form_id, formstack_submission_id, plan,
   payment_status, amount_cents, document_status, submitted_at, raw_payload)
values
  (null, 'seed_form', 'seed-orphan-1', 'individual_299', 'paid', 29900, 'generated',
   now() - interval '6 hours', '{"email":"walkin1@seed.test","note":"opened form outside app"}'),
  (null, 'seed_form', 'seed-orphan-2', 'joint_399', 'paid', 39900, 'generated',
   now() - interval '2 hours', '{"email":"walkin2@seed.test","note":"opened form outside app"}');

drop table _seed;

-- Quick sanity check (optional): SELECT * FROM v_funnel_totals;
