-- Applied live 2026-09-18 as promise6_zoning_standards_model; committed verbatim
-- so the repo matches the database.

-- PROMISE-6 (issue 20518). /pricing prints, for Pro:
--   "Full ZoneWise zoning per property: setbacks, parking, height, land use,
--    units per acre, FAR, permitted uses, overlays"
-- Eight named fields. Live, before this migration, the count of real rows was:
--   zw_zoning.zoning_setbacks 0, zoning_max_ht 0, zoning_permitted 0, flu_code 0
--   zw_parcels: same four at 0, zoning_code on 343,787 of 10,514,611 (3.3%)
--   parking, FAR, units-per-acre, overlays: no column anywhere
-- What a Pro subscriber actually sees for setbacks/height/density comes from
-- parseDimensionalStandards() in lib/zoning.ts — a regex table that returns the
-- same "Front: 25ft, Side: 7.5ft, Rear: 20ft" for every R-1 parcel in Florida.
-- It is labelled an estimate in the UI, which is honest, but it is not a
-- per-property zoning read and it is not eight fields.
--
-- The modelling mistake underneath is why nobody ever filled those columns:
-- dimensional standards are NOT a property attribute. They are set by a
-- JURISDICTION for a ZONE CODE, and every parcel carrying that code inherits
-- them. Storing them per parcel means 2.18M rows to research instead of a
-- bounded table, so the columns stayed empty for a year.
--
-- Bounded, measured 2026-09-18: 1,651 distinct (jurisdiction, zone code) pairs
-- cover all 2,178,194 coded parcels, and just 106 pairs cover every upcoming
-- auction that currently resolves to a zone code at all. 106 is a research job
-- someone can finish.
create table if not exists public.zw_zoning_standards (
  id                  uuid primary key default gen_random_uuid(),
  jurisdiction        text not null,
  zoning_code         text not null,
  zoning_desc         text,
  -- The eight the page names. NULL means "not researched yet", never a guess:
  -- a fabricated setback is worse than a blank one, because a blank cannot be
  -- relied on by mistake.
  setbacks            jsonb,          -- {front, side, side_street, rear} in feet
  parking             jsonb,          -- {spaces_per_unit, per_1000_sqft, notes}
  max_height_ft       numeric,
  max_stories         int,
  land_use            text,           -- the future land use designation this code implements
  units_per_acre      numeric,
  far_max             numeric,
  permitted_uses      jsonb,          -- array of use strings, as written in the code
  overlays            jsonb,          -- array of overlay districts that apply
  min_lot_sqft        numeric,
  -- Provenance is not optional. A standard nobody can trace is a rumour.
  source_url          text,
  source_citation     text,           -- e.g. "Land Development Code sec. 5.03.02"
  verified_at         timestamptz,
  verified_by         text,
  confidence          numeric default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists zw_zoning_standards_jur_code_idx
  on public.zw_zoning_standards (lower(jurisdiction), upper(zoning_code));

alter table public.zw_zoning_standards enable row level security;
revoke all on table public.zw_zoning_standards from anon, authenticated;

-- The research queue, ranked by what it actually unlocks: how many auctions
-- coming up are carrying this jurisdiction and code. Working the top of this
-- list is the shortest path from "eight fields promised" to "eight fields
-- delivered" on the properties a subscriber is looking at this week.
create or replace view public.zw_zoning_standards_queue as
with up as (
  select lower(a.county) as county,
         regexp_replace(upper(coalesce(a.parcel_id, '')), '[^A-Z0-9]', '', 'g') as pin
  from public.multi_county_auctions a
  where a.auction_status in ('upcoming', 'scheduled')
    and a.auction_date >= current_date
    and a.parcel_id is not null
),
matched as (
  select coalesce(nullif(btrim(z.zoning_jurisdiction), ''), z.county) as jurisdiction,
         upper(btrim(z.zoning_code)) as zoning_code,
         max(z.zoning_desc) as zoning_desc,
         count(*) as upcoming_auctions
  from up
  join public.zw_zoning z
    on lower(z.county) = up.county
   and regexp_replace(upper(coalesce(z.pin_clean, z.pin, '')), '[^A-Z0-9]', '', 'g') = up.pin
  where z.zoning_code is not null and btrim(z.zoning_code) <> ''
  group by 1, 2
)
select m.jurisdiction,
       m.zoning_code,
       m.zoning_desc,
       m.upcoming_auctions,
       (s.id is not null) as researched,
       s.verified_at,
       s.confidence
from matched m
left join public.zw_zoning_standards s
  on lower(s.jurisdiction) = lower(m.jurisdiction)
 and upper(s.zoning_code) = m.zoning_code
order by m.upcoming_auctions desc, m.jurisdiction, m.zoning_code;

-- One read for the app: resolve a parcel to its zone code, then to the
-- jurisdiction standards for that code. Returns nulls, loudly, where nothing
-- has been verified — the caller decides whether to show a labelled estimate
-- next to a blank, and the API marks the source of every field so a Pioneer
-- can tell which numbers are real.
create or replace function public.zoning_standards_for_parcel(
  p_county    text,
  p_parcel_id text
) returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with z as (
    select coalesce(nullif(btrim(zz.zoning_jurisdiction), ''), zz.county) as jurisdiction,
           upper(btrim(zz.zoning_code)) as zoning_code,
           zz.zoning_desc,
           zz.zoning_category,
           zz.flu_code,
           zz.flu_desc
    from public.zw_zoning zz
    where lower(zz.county) = lower(coalesce(p_county, ''))
      and regexp_replace(upper(coalesce(zz.pin_clean, zz.pin, '')), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(coalesce(p_parcel_id, '')), '[^A-Z0-9]', '', 'g')
      and zz.zoning_code is not null
    limit 1
  )
  select jsonb_build_object(
    'zoning_code',    (select zoning_code from z),
    'zoning_desc',    (select zoning_desc from z),
    'jurisdiction',   (select jurisdiction from z),
    'land_use',       coalesce((select flu_desc from z), (select flu_code from z), (select s.land_use from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code)),
    'setbacks',       (select s.setbacks from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'parking',        (select s.parking from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'max_height_ft',  (select s.max_height_ft from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'max_stories',    (select s.max_stories from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'units_per_acre', (select s.units_per_acre from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'far_max',        (select s.far_max from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'permitted_uses', (select s.permitted_uses from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'overlays',       (select s.overlays from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'min_lot_sqft',   (select s.min_lot_sqft from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'source_url',     (select s.source_url from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'source_citation',(select s.source_citation from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'verified_at',    (select s.verified_at from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code),
    'standards_verified', exists (select 1 from public.zw_zoning_standards s, z where lower(s.jurisdiction) = lower(z.jurisdiction) and upper(s.zoning_code) = z.zoning_code and s.verified_at is not null)
  )
$fn$;

revoke all on function public.zoning_standards_for_parcel(text, text) from anon, authenticated, public;

