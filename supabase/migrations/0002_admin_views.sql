-- Read-only aggregate views for the admin funnel dashboard.
-- Accessed ONLY by the admin-metrics Edge Function via service_role (which
-- bypasses RLS). Explicitly revoked from anon/authenticated so PostgREST can
-- never leak these aggregates to the public publishable key.

create view v_funnel_step_counts as
select event_type, count(distinct session_id) as sessions
from funnel_events
group by event_type;

create view v_funnel_totals as
select
  (select count(*) from app_sessions)                                        as total_sessions,
  (select count(*) from leads)                                               as total_leads,
  (select count(*) from formstack_submissions)                               as total_submissions,
  (select count(*) from formstack_submissions where payment_status = 'paid') as paid_submissions,
  (select count(*) from app_sessions where status = 'converted')             as converted_sessions,
  (select count(*) from app_sessions where status = 'abandoned')             as abandoned_sessions,
  (select count(*) from formstack_submissions where session_id is null)      as orphan_submissions;

revoke all on v_funnel_step_counts from anon, authenticated;
revoke all on v_funnel_totals from anon, authenticated;
