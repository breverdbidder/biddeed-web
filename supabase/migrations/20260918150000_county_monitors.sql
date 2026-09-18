-- PROMISE-9 (issue 20518). Applied live 2026-09-18 as promise9_county_monitors;
-- committed so the repo matches the database.
--
-- /pricing prints a county-monitor count on every paid tier: 1 on Investor,
-- 3 on Pro, 10 on Pro Plus. mcp_subscription_tiers already carries exactly
-- those numbers in counties_monitored (0/1/3/10), so the promise and the
-- ledger agreed — what was missing is the thing itself.
--
-- public.auction_watches is NOT it: that watches a single case number in a
-- county, which needs you to already know the case. It holds 0 rows. A county
-- monitor is the standing instruction — tell me what is coming in Brevard.
create table if not exists public.county_monitors (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null,
  email          text,
  county         text not null,
  alert_types    text[] not null default array['new_listing','sale_date_change','opening_bid_change'],
  channels       text[] not null default array['email'],
  timezone       text not null default 'America/New_York',
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint county_monitors_status_check check (status in ('active','paused','archived'))
);

-- One active monitor per county per person: re-adding a county you already
-- monitor is a no-op, not a second seat against the cap.
create unique index if not exists county_monitors_user_county_idx
  on public.county_monitors (clerk_user_id, lower(county)) where status = 'active';
create index if not exists county_monitors_county_idx
  on public.county_monitors (lower(county)) where status = 'active';

alter table public.county_monitors enable row level security;
revoke all on table public.county_monitors from anon, authenticated;

-- The cap is the promise, enforced in one place, reading the number off
-- mcp_subscription_tiers rather than holding a second copy of 1/3/10.
create or replace function public.add_county_monitor(
  p_clerk_user_id text,
  p_email         text,
  p_county        text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_tier     text := 'free';
  v_cap      int  := 0;
  v_active   int;
  v_existing uuid;
  v_id       uuid;
begin
  if coalesce(btrim(p_clerk_user_id), '') = '' or coalesce(btrim(p_county), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_arguments');
  end if;

  select coalesce(c.tier_id, 'free') into v_tier
    from public.mcp_customers c
   where lower(c.email) = lower(coalesce(btrim(p_email), '')) limit 1;
  v_tier := coalesce(v_tier, 'free');

  select coalesce(t.counties_monitored, 0) into v_cap
    from public.mcp_subscription_tiers t where t.tier_id = v_tier;
  v_cap := coalesce(v_cap, 0);

  perform pg_advisory_xact_lock(hashtext('county_monitor:' || p_clerk_user_id));

  select m.id into v_existing from public.county_monitors m
   where m.clerk_user_id = p_clerk_user_id and lower(m.county) = lower(btrim(p_county)) and m.status = 'active'
   limit 1;

  select count(*) into v_active from public.county_monitors m
   where m.clerk_user_id = p_clerk_user_id and m.status = 'active';

  if v_existing is not null then
    return jsonb_build_object('ok', true, 'reason', 'already_monitored', 'monitor_id', v_existing,
                              'tier_id', v_tier, 'cap', v_cap, 'used', v_active,
                              'remaining', greatest(v_cap - v_active, 0));
  end if;

  if v_cap <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'tier_has_no_monitors', 'tier_id', v_tier,
                              'cap', 0, 'used', v_active, 'remaining', 0);
  end if;

  if v_active >= v_cap then
    return jsonb_build_object('ok', false, 'reason', 'cap_reached', 'tier_id', v_tier,
                              'cap', v_cap, 'used', v_active, 'remaining', 0);
  end if;

  insert into public.county_monitors (clerk_user_id, email, county)
  values (p_clerk_user_id, lower(nullif(btrim(p_email), '')), lower(btrim(p_county)))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'reason', 'created', 'monitor_id', v_id, 'tier_id', v_tier,
                            'cap', v_cap, 'used', v_active + 1, 'remaining', greatest(v_cap - v_active - 1, 0));
end;
$fn$;

revoke all on function public.add_county_monitor(text, text, text) from anon, authenticated, public;
