-- Heatmap KPI funnel events (issue #75).
--
-- No SQL migrations directory existed in biddeed-web before this — the
-- Supabase schema for this project (mocerqjnksmhcjzxrewo) has been managed
-- outside the repo. This file is the proposal; the build agent that authored
-- it had no live database credentials in its sandbox (SUPABASE_URL /
-- SUPABASE_SERVICE_ROLE_KEY were present as empty env vars, not real
-- secrets), so this migration has NOT been applied anywhere. The owner (or
-- CI with real credentials) must run it against the live project before
-- /api/analytics/event can write anything. See docs/spec/75.md.
--
-- Table holds one row per funnel event. event_name is a closed set mirroring
-- lib/heatmap/config.ts FUNNEL_EVENTS — keep the two in lockstep by hand,
-- there is no codegen link between a Postgres CHECK and a TS union.

create table if not exists public.heatmap_funnel_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'heatmap_view',
    'layer_change',
    'gate_shown',
    'signup_started',
    'signup_completed',
    'premium_gate_shown',
    'parcel_drill',
    'signal_cta_click',
    'upgrade_click',
    'purchase_referred',
    'homepage_map_view',
    'homepage_map_interact',
    'homepage_kpi_layer_change',
    'homepage_area_teaser_click',
    'homepage_to_maps_click'
  )),
  occurred_at timestamptz not null default now(),
  -- Anonymous session id (client-generated, sessionStorage) — event rows are
  -- attributable across a single visit even before a Clerk account exists,
  -- which is most of the funnel by definition (view -> gate -> signup).
  session_id text,
  clerk_user_id text,
  surface text not null default 'maps' check (surface in ('homepage', 'maps')),
  geography_level text check (geography_level in ('county', 'zip')),
  geography_id text,
  kpi_layer text,
  source text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists heatmap_funnel_events_event_name_idx
  on public.heatmap_funnel_events (event_name, occurred_at desc);

create index if not exists heatmap_funnel_events_geography_idx
  on public.heatmap_funnel_events (geography_id, occurred_at desc);

create index if not exists heatmap_funnel_events_session_idx
  on public.heatmap_funnel_events (session_id, occurred_at);

alter table public.heatmap_funnel_events enable row level security;

-- Writes come only from app/api/analytics/event/route.ts using the service
-- role key (same trust boundary as every other write path in this repo —
-- see lib/supabase-retry.ts). No anon/authenticated INSERT policy is granted,
-- so a client cannot write directly to this table even if it discovered the
-- REST endpoint.
drop policy if exists heatmap_funnel_events_service_role_all on public.heatmap_funnel_events;
create policy heatmap_funnel_events_service_role_all
  on public.heatmap_funnel_events
  for all
  to service_role
  using (true)
  with check (true);

-- Weekly funnel rollup (acceptance criteria: "a simple admin query/view must
-- answer weekly: views -> gate shown -> signup -> drill -> SIGNAL$ CTA ->
-- purchase, per KPI layer and geography").
create or replace view public.heatmap_funnel_weekly as
select
  date_trunc('week', occurred_at) as week_start,
  coalesce(kpi_layer, '(none)') as kpi_layer,
  coalesce(geography_id, '(none)') as geography_id,
  count(*) filter (where event_name in ('heatmap_view', 'homepage_map_view')) as views,
  count(*) filter (where event_name in ('gate_shown', 'premium_gate_shown')) as gate_shown,
  count(*) filter (where event_name = 'signup_completed') as signups,
  count(*) filter (where event_name = 'parcel_drill') as drills,
  count(*) filter (where event_name = 'signal_cta_click') as signal_cta_clicks,
  count(*) filter (where event_name = 'purchase_referred') as purchases_referred
from public.heatmap_funnel_events
group by 1, 2, 3
order by 1 desc, views desc;

comment on view public.heatmap_funnel_weekly is
  'Weekly heatmap funnel rollup per KPI layer + geography (issue #75). Query: select * from public.heatmap_funnel_weekly order by week_start desc limit 50;';
