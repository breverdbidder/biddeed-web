-- Issue 20700 B2: saved Investment Briefs and the broker brand profile they render with.
-- Service-role only (M2): RLS on, no policy, no grants to anon or authenticated.
-- `organizations` with brand fields did not exist in public (winnerdata.organizations is another product), so the brand lives here.
create table if not exists public.broker_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  license_no text,
  primary_color text check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$'),
  owner_clerk_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investment_briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.broker_orgs(id),
  created_by_clerk_user_id text not null,
  input jsonb not null,
  brief jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists investment_briefs_org_created_idx on public.investment_briefs (org_id, created_at desc);
create index if not exists investment_briefs_user_created_idx on public.investment_briefs (created_by_clerk_user_id, created_at desc);

alter table public.broker_orgs enable row level security;
alter table public.investment_briefs enable row level security;
revoke all on public.broker_orgs, public.investment_briefs from anon, authenticated;
