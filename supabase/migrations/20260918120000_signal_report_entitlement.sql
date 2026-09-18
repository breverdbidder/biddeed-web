-- PROMISE-2 / PROMISE-4 (cli-anything-biddeed issue 20518).
--
-- Applied live on 2026-09-18 as two migrations,
-- promise2_report_allowance_matches_printed and promise4_claim_signal_report_rpc.
-- Kept here so this repo's migration history matches the database.
--
-- PROMISE-2: /pricing prints 30 SIGNAL$ Property Reports a month for Pro and
-- 50 for Pro Plus. mcp_subscription_tiers enforced 10 and 25. Ariel's call was
-- to build to the printed promise rather than lower it, so the ledger moves to
-- the page. Investor already matched at 10 and is left alone.
update public.mcp_subscription_tiers set s5_calls_monthly = 30 where tier_id = 'pro'     and s5_calls_monthly is distinct from 30;
update public.mcp_subscription_tiers set s5_calls_monthly = 50 where tier_id = 'proplus' and s5_calls_monthly is distinct from 50;

-- PROMISE-4: a subscriber had no way to consume the reports they pay for.
-- lib/deed/reports.ts only unlocked a report when a report_delivery_queue row
-- matched a $25 one-time purchase, and /buy-report charged $25 with no tier
-- awareness, so a Pioneer paying $990/yr for thirty reports a month could not
-- take one.
--
-- Deliberately a separate table from report_delivery_queue: that one is the
-- one-time purchase ledger keyed to a Stripe session, and 22 of its 25 rows
-- are unpaid expired checkouts. Mixing an entitlement grant into a payment
-- queue would make "did they pay" unanswerable.
create table if not exists public.signal_report_claims (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null,
  email          text not null,
  tier_id        text not null,
  period_start   date not null,
  county         text not null,
  case_number    text not null,
  mca_id         uuid,
  status         text not null default 'pending',
  report_pdf_url text,
  error          text,
  created_at     timestamptz not null default now(),
  delivered_at   timestamptz,
  constraint signal_report_claims_status_check check (status in ('pending','delivered','failed'))
);

-- One claim per property per customer, ever: reopening a report you already
-- claimed must not cost a second credit.
create unique index if not exists signal_report_claims_customer_property_idx
  on public.signal_report_claims (customer_id, lower(county), upper(case_number));

create index if not exists signal_report_claims_period_idx
  on public.signal_report_claims (customer_id, period_start);

alter table public.signal_report_claims enable row level security;
revoke all on table public.signal_report_claims from anon, authenticated;

-- claim_signal_report() is the only thing that may spend a monthly credit, the
-- same way user_has_capability is the only answer on tool gates, so the web app
-- and the MCP cannot drift into two different numbers.
--
-- Three rules, all load-bearing:
--   1. Re-claiming a property you already claimed is free and returns the
--      original row.
--   2. The period is calendar month in America/New_York, not UTC. A Florida
--      subscriber's month must not roll over at 8pm on the last day.
--   3. A transaction-scoped advisory lock per customer serialises the count, so
--      two tabs cannot both read "29 used" and both insert.
create or replace function public.claim_signal_report(
  p_email       text,
  p_county      text,
  p_case_number text,
  p_mca_id      uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_customer_id uuid;
  v_tier        text;
  v_allowance   int;
  v_period      date := date_trunc('month', (now() at time zone 'America/New_York'))::date;
  v_used        int;
  v_id          uuid;
  v_status      text;
  v_url         text;
begin
  if coalesce(btrim(p_email), '') = '' or coalesce(btrim(p_county), '') = '' or coalesce(btrim(p_case_number), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_arguments');
  end if;

  select c.customer_id, coalesce(c.tier_id, 'free')
    into v_customer_id, v_tier
    from public.mcp_customers c
   where lower(c.email) = lower(btrim(p_email))
   limit 1;

  if v_customer_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_customer', 'tier_id', 'free',
                              'allowance', 0, 'used', 0, 'remaining', 0);
  end if;

  select coalesce(t.s5_calls_monthly, 0) into v_allowance
    from public.mcp_subscription_tiers t where t.tier_id = v_tier;
  v_allowance := coalesce(v_allowance, 0);

  perform pg_advisory_xact_lock(hashtext('signal_report_claim:' || v_customer_id::text));

  select s.id, s.status, s.report_pdf_url into v_id, v_status, v_url
    from public.signal_report_claims s
   where s.customer_id = v_customer_id
     and lower(s.county) = lower(btrim(p_county))
     and upper(s.case_number) = upper(btrim(p_case_number))
   limit 1;

  select count(*) into v_used
    from public.signal_report_claims s
   where s.customer_id = v_customer_id and s.period_start = v_period;

  if v_id is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_claimed', 'claim_id', v_id,
                              'status', v_status, 'report_pdf_url', v_url, 'tier_id', v_tier,
                              'allowance', v_allowance, 'used', v_used,
                              'remaining', greatest(v_allowance - v_used, 0), 'period_start', v_period);
  end if;

  if v_allowance <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'tier_has_no_allowance', 'tier_id', v_tier,
                              'allowance', 0, 'used', v_used, 'remaining', 0, 'period_start', v_period);
  end if;

  if v_used >= v_allowance then
    return jsonb_build_object('ok', false, 'reason', 'allowance_exhausted', 'tier_id', v_tier,
                              'allowance', v_allowance, 'used', v_used, 'remaining', 0,
                              'period_start', v_period);
  end if;

  insert into public.signal_report_claims (customer_id, email, tier_id, period_start, county, case_number, mca_id)
  values (v_customer_id, lower(btrim(p_email)), v_tier, v_period, btrim(p_county), upper(btrim(p_case_number)), p_mca_id)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'reason', 'claimed', 'claim_id', v_id, 'status', 'pending',
                            'report_pdf_url', null, 'tier_id', v_tier, 'allowance', v_allowance,
                            'used', v_used + 1, 'remaining', greatest(v_allowance - v_used - 1, 0),
                            'period_start', v_period);
end;
$fn$;

-- Read-only companion so the UI can print "N of 30 left this month" without
-- spending anything. Same period arithmetic, deliberately duplicated rather
-- than shared, so a change to one can never silently move the other.
create or replace function public.signal_report_allowance(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_customer_id uuid;
  v_tier        text;
  v_allowance   int;
  v_period      date := date_trunc('month', (now() at time zone 'America/New_York'))::date;
  v_used        int;
begin
  select c.customer_id, coalesce(c.tier_id, 'free') into v_customer_id, v_tier
    from public.mcp_customers c where lower(c.email) = lower(coalesce(btrim(p_email), '')) limit 1;

  if v_customer_id is null then
    return jsonb_build_object('tier_id', 'free', 'allowance', 0, 'used', 0, 'remaining', 0, 'period_start', v_period);
  end if;

  select coalesce(t.s5_calls_monthly, 0) into v_allowance
    from public.mcp_subscription_tiers t where t.tier_id = v_tier;
  v_allowance := coalesce(v_allowance, 0);

  select count(*) into v_used from public.signal_report_claims s
   where s.customer_id = v_customer_id and s.period_start = v_period;

  return jsonb_build_object('tier_id', v_tier, 'allowance', v_allowance, 'used', v_used,
                            'remaining', greatest(v_allowance - v_used, 0), 'period_start', v_period);
end;
$fn$;

-- Service role only: both read customer email addresses and one of them spends
-- money-equivalent credit. The web app calls them with the service client
-- behind a Clerk session, never from the browser.
revoke all on function public.claim_signal_report(text, text, text, uuid) from anon, authenticated, public;
revoke all on function public.signal_report_allowance(text) from anon, authenticated, public;
