-- PROMISE-10 (issue 20518). Applied live 2026-09-18 as
-- promise10_auction_outcome_scorecard; committed so the repo matches the database.
--
-- /pricing prints "Outcome scorecard after each sale" as an Investor checkmark,
-- inherited by Pro and Pro Plus. Nothing in the product surfaced a completed
-- sale: public.auction_results holds 5 rows, latest 2025-12-30;
-- public.daily_auction_outcomes holds 0; /api/auctions has no status filter.
--
-- The data was always there: 3,709 sales with a sold amount across 60
-- counties, 2,119 of them in the last 180 days, 2,707 with the opening bid to
-- compare against and 2,579 with a named winning bidder.
--
-- A sold amount on its own is a fact, not a scorecard. What makes it a
-- scorecard is what it sits next to: what the sale opened at, what the county
-- assessed the property at, and who took it.
create or replace function public.auction_outcome_scorecard(
  p_county text default null,
  p_days   int  default 180,
  p_limit  int  default 50
)
returns table (
  id                   uuid,
  county               text,
  case_number          text,
  property_address     text,
  auction_date         date,
  sale_type            text,
  plaintiff            text,
  opening_bid          numeric,
  assessed_value       numeric,
  sold_amount          numeric,
  winning_bidder       text,
  winner_kind          text,
  premium_over_opening numeric,
  premium_pct          numeric,
  sold_to_assessed_pct numeric
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    a.id,
    a.county::text,
    a.case_number::text,
    a.property_address::text,
    a.auction_date::date,
    a.sale_type::text,
    a.plaintiff::text,
    a.opening_bid,
    a.assessed_value,
    a.sold_amount,
    a.winning_bidder::text,
    -- Three outcomes a bidder actually cares about telling apart: it went to
    -- the street, it went back to the bank, or a named party took it.
    case
      when a.winning_bidder is null then 'unknown'
      when a.winning_bidder ~* '(3rd|third)[[:space:]]*party' then 'third_party'
      when a.winning_bidder ~* '^plaintiff$' then 'plaintiff'
      when a.plaintiff is not null and a.plaintiff <> ''
           and lower(a.winning_bidder) = lower(a.plaintiff) then 'plaintiff'
      else 'named_bidder'
    end as winner_kind,
    case when a.opening_bid is not null then a.sold_amount - a.opening_bid end as premium_over_opening,
    case when a.opening_bid is not null and a.opening_bid > 0
         then round(((a.sold_amount - a.opening_bid) / a.opening_bid) * 100, 1) end as premium_pct,
    case when a.assessed_value is not null and a.assessed_value > 0
         then round((a.sold_amount / a.assessed_value) * 100, 1) end as sold_to_assessed_pct
  from public.multi_county_auctions a
  where a.sold_amount is not null
    and a.sold_amount > 0
    and a.auction_date >= (current_date - greatest(coalesce(p_days, 180), 1))
    and a.auction_date <= current_date
    and (p_county is null or lower(a.county) = lower(p_county))
  order by a.auction_date desc, a.sold_amount desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$fn$;

revoke all on function public.auction_outcome_scorecard(text, int, int) from anon, authenticated, public;
