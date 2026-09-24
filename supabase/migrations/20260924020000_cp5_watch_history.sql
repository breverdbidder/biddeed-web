-- PARITY CP-5 (Deed Watches), 2026-09-24.
-- 1. Every confirmed alert send is logged to agent_ops_log with its Resend
--    message id (the CP-5 proof asks for exactly that row). The reconcile step
--    already reads Resend's reply to store resend_id; it now also writes one
--    ops-log row per send it resolves. No recipient address is logged.
-- 2. Sends resolved before this change are backfilled once, marked backfilled.
-- 3. deed_watch_health(): the alert job's state (on/off, last finished run,
--    runs and failures in 24 h) for the Scheduled page's status line.
--    Service role only.

create or replace function public.reconcile_auction_watch_sends()
 returns integer
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare v_n int := 0;
begin
  with r as (
    select n.id, h.status_code, h.content
      from public.auction_watch_notifications n
      join net._http_response h on h.id = n.request_id
     where n.send_status = 'sent' and n.resend_id is null and n.last_error is null
  ), u as (
    update public.auction_watch_notifications n
       set resend_id  = case when r.status_code between 200 and 299 then (r.content::jsonb ->> 'id') end,
           send_status = case when r.status_code between 200 and 299 then 'sent'
                              when n.send_attempts < 3 then 'queued' else 'failed' end,
           last_error = case when r.status_code between 200 and 299 then null
                             else left(coalesce(r.status_code::text,'') || ' ' || coalesce(r.content,''), 300) end
      from r where r.id = n.id
    returning n.id, n.watch_id, n.alert_type, n.send_status, n.send_attempts, n.resend_id,
              (n.ics is not null) as calendar_attached, r.status_code
  )
  insert into public.agent_ops_log (dispatch_id, task, status, severity, evidence)
  select 'deed-watch-notification-' || u.id || '-attempt-' || u.send_attempts,
         'deed_watch_alert',
         case when u.resend_id is not null then 'VERIFIED'
              when u.send_status = 'failed' then 'BLOCKED' else 'PARTIAL' end,
         case when u.resend_id is not null then 'info' else 'warn' end,
         jsonb_build_object('notification_id', u.id, 'watch_id', u.watch_id, 'alert_type', u.alert_type,
                            'resend_id', u.resend_id, 'http_status', u.status_code,
                            'send_status', u.send_status, 'calendar_attached', u.calendar_attached)::text
    from u;
  get diagnostics v_n = row_count;
  return v_n;
end
$function$;

insert into public.agent_ops_log (dispatch_id, task, status, severity, evidence)
select 'deed-watch-notification-' || n.id || '-attempt-' || n.send_attempts,
       'deed_watch_alert', 'VERIFIED', 'info',
       jsonb_build_object('notification_id', n.id, 'watch_id', n.watch_id, 'alert_type', n.alert_type,
                          'resend_id', n.resend_id, 'send_status', n.send_status,
                          'calendar_attached', n.ics is not null, 'backfilled', true)::text
  from public.auction_watch_notifications n
 where n.resend_id is not null
   and not exists (select 1 from public.agent_ops_log l
                    where l.task = 'deed_watch_alert'
                      and l.dispatch_id = 'deed-watch-notification-' || n.id || '-attempt-' || n.send_attempts);

create or replace function public.deed_watch_health()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  -- cron.job_run_details holds every job's runs (~5k a day) with only a runid
  -- index: read the last ~8000 runs (about 38 h) through that index instead of
  -- scanning the table. The upper bound keeps the planner on the index.
  with j as (
    select jobid, active, schedule from cron.job where jobname = 'deed-watch-alerts' limit 1
  ), runs as (
    select d.status, d.start_time, d.end_time, d.runid
      from cron.job_run_details d, j
     where d.runid > (select max(runid) from cron.job_run_details) - 8000
       and d.runid <= 9223372036854775807
       and d.jobid = j.jobid
       and d.status in ('succeeded', 'failed')
  ), last_run as (
    select status, coalesce(end_time, start_time) as at from runs order by runid desc limit 1
  )
  select jsonb_build_object(
    'active', coalesce((select active from j), false),
    'schedule', (select schedule from j),
    'last_run_at', (select at from last_run),
    'last_status', (select status from last_run),
    'runs_24h', (select count(*) from runs where start_time > now() - interval '24 hours'),
    'failed_24h', (select count(*) from runs where start_time > now() - interval '24 hours' and status = 'failed'))
$function$;

revoke all on function public.deed_watch_health() from public, anon, authenticated;
grant execute on function public.deed_watch_health() to service_role;
