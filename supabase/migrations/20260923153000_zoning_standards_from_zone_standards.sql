-- ZW-P0-003: Prefer researched public.zone_standards over empty zw_zoning_standards.
--
-- Context (measured 2026-09-23 on mocerqjnksmhcjzxrewo):
--   zone_standards          ~3,563 rows (front/side/rear setbacks, height, FAR, density…)
--   zw_zoning_standards         0 rows  ← previous RPC join target, so standards_verified
--                                         was always false and AuctionDetail fell through
--                                         to parseDimensionalStandards() regex fiction.
--
-- Join path:
--   parcel → (zw_zoning OR fl_parcel_for_auction) → jurisdictions → zoning_districts
--         → zone_standards
-- Response shape stays compatible with types/auctions.ts ZoningStandards
-- (setbacks as {front,side,side_street,rear}, far_max, units_per_acre, …).
-- standards_verified is true only when a zone_standards (or legacy verified
-- zw_zoning_standards) row matched — never fabricated.

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
    -- Prefer zw_zoning (jurisdiction-aware), else fl_parcel_for_auction zone+muni.
    select *
    from (
      select
        coalesce(nullif(btrim(zz.zoning_jurisdiction), ''), zz.county) as jurisdiction,
        upper(btrim(zz.zoning_code)) as zoning_code,
        zz.zoning_desc,
        zz.flu_code,
        zz.flu_desc,
        1 as rank
      from public.zw_zoning zz
      where lower(zz.county) = lower(coalesce(p_county, ''))
        and regexp_replace(upper(coalesce(zz.pin_clean, zz.pin, '')), '[^A-Z0-9]', '', 'g')
          = regexp_replace(upper(coalesce(p_parcel_id, '')), '[^A-Z0-9]', '', 'g')
        and zz.zoning_code is not null
        and btrim(zz.zoning_code) <> ''

      union all

      select
        coalesce(nullif(btrim(f.municipality), ''), p_county) as jurisdiction,
        upper(btrim(f.zone_code)) as zoning_code,
        null::text as zoning_desc,
        f.future_land_use as flu_code,
        f.future_land_use as flu_desc,
        2 as rank
      from public.fl_parcel_for_auction(p_county, p_parcel_id) f
      where f.zone_code is not null
        and btrim(f.zone_code) <> ''
    ) q
    order by rank
    limit 1
  ),
  j as (
    select ju.*
    from public.jurisdictions ju
    cross join z
    where
      lower(ju.name) = lower(z.jurisdiction)
      or lower(ju.name) = lower(replace(z.jurisdiction, '_', ' '))
      or (
        lower(replace(z.jurisdiction, ' ', '_')) in (
          'unincorporated', 'brevard', 'brevard_county', 'unincorporated_brevard',
          'unincorporated_brevard_county'
        )
        and lower(coalesce(ju.county, ju.county_name, '')) = lower(coalesce(p_county, ''))
        and lower(ju.name) like 'unincorporated%'
      )
    limit 1
  ),
  std as (
    -- Researched dimensional standards (zone_standards ← zoning_districts).
    select
      zs.*,
      zd.code as district_code,
      zd.name as district_name,
      j.name as juris_name
    from z
    join j on true
    join public.zoning_districts zd
      on zd.jurisdiction_id = j.id
     and upper(btrim(zd.code)) = z.zoning_code
    join public.zone_standards zs
      on zs.zoning_district_id = zd.id
    limit 1
  ),
  legacy as (
    -- Keep the empty zw_zoning_standards path in case research lands there later.
    select s.*
    from public.zw_zoning_standards s
    cross join z
    where lower(s.jurisdiction) = lower(z.jurisdiction)
      and upper(s.zoning_code) = z.zoning_code
    limit 1
  )
  select jsonb_build_object(
    'zoning_code',     (select zoning_code from z),
    'zoning_desc',     coalesce(
                         (select district_name from std),
                         (select zoning_desc from z),
                         (select zoning_desc from legacy)
                       ),
    'jurisdiction',    coalesce(
                         (select juris_name from std),
                         (select jurisdiction from z)
                       ),
    'land_use',        coalesce(
                         (select flu_desc from z),
                         (select flu_code from z),
                         (select land_use from legacy)
                       ),
    'setbacks',        coalesce(
                         (select jsonb_strip_nulls(jsonb_build_object(
                            'front', front_setback_ft,
                            'side', side_setback_ft,
                            'side_street', corner_setback_ft,
                            'rear', rear_setback_ft
                          )) from std),
                         (select setbacks from legacy)
                       ),
    'parking',         coalesce(
                         (select case
                            when parking_per_unit is null and parking_per_1000sf is null then null
                            else jsonb_strip_nulls(jsonb_build_object(
                              'spaces_per_unit', parking_per_unit,
                              'per_1000_sqft', parking_per_1000sf
                            ))
                          end from std),
                         (select parking from legacy)
                       ),
    'max_height_ft',   coalesce(
                         (select max_height_ft from std),
                         (select max_height_ft from legacy)
                       ),
    'max_stories',     coalesce(
                         (select max_stories from std),
                         (select max_stories from legacy)
                       ),
    'units_per_acre',  coalesce(
                         (select max_density_du_acre from std),
                         (select units_per_acre from legacy)
                       ),
    'far_max',         coalesce(
                         (select max_far from std),
                         (select far_max from legacy)
                       ),
    'permitted_uses',  (select permitted_uses from legacy),
    'overlays',        (select overlays from legacy),
    'min_lot_sqft',    coalesce(
                         (select min_lot_sqft from std),
                         (select min_lot_sqft from legacy)
                       ),
    'source_url',      coalesce(
                         (select source_url from std),
                         (select source_url from legacy)
                       ),
    'source_citation', coalesce(
                         (select ordinance_section from std),
                         (select source_citation from legacy)
                       ),
    'verified_at',     coalesce(
                         (select scraped_at from std),
                         (select verified_at from legacy)
                       ),
    'confidence_score', coalesce(
                         (select confidence_score from std),
                         (select confidence from legacy)
                       ),
    'standards_source', case
                          when exists (select 1 from std) then 'zone_standards'
                          when exists (select 1 from legacy where verified_at is not null) then 'zw_zoning_standards'
                          else null
                        end,
    'standards_verified',
      exists (select 1 from std)
      or exists (select 1 from legacy where verified_at is not null)
  )
$fn$;

revoke all on function public.zoning_standards_for_parcel(text, text) from anon, authenticated, public;
grant execute on function public.zoning_standards_for_parcel(text, text) to service_role;
