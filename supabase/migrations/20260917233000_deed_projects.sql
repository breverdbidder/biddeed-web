-- PARITY CP-4 — Projects (C3, issue #19847 re-based on the Clerk-sub identity of CP-3).
--
-- PROPOSAL, not applied: schema changes are signed by the owner (meta prompt
-- 0.10). Apply against mocerqjnksmhcjzxrewo with the service role, then the
-- routes under app/api/deed/projects* answer 200 instead of 503 "not
-- configured" — no redeploy needed.
--
-- WHAT A PROJECT IS. One property / one bid the customer is working toward
-- (the Claude.ai Projects reference): persistent context (S1), the hooks that
-- create it from a county page, a calendar row or a report (S2, first_touch),
-- its own chat threads (S4, deed_threads.project_id) and its files (the
-- "attachment and download abilities"), plus last-seen (S5). Progressive
-- disclosure of the SIGNAL$ report (S3), generated reports and share links are
-- the next PR on the same tables.
--
-- WHY NEW TABLES. The Worker-era public.biddeed_projects / _project_files /
-- _project_items rows are keyed on owner_email — an email the visitor typed
-- (issue #20226). Nothing reads them any more and nothing here migrates them
-- (2 projects, 2 files, 0 items — test traffic). These tables are keyed on
-- the Clerk `sub` that app/api/* verifies server-side with auth().
--
-- ACCESS MODEL. Same as deed_threads / deed_uploads: row-level security ON
-- with NO policies and every grant to anon / authenticated revoked — only the
-- service role (the Next.js routes) touches these rows, and every query in
-- those routes carries `.eq('owner_user_id', auth().userId)`.
--
-- FILES live in the existing PRIVATE bucket `artifacts` (0 storage policies,
-- service role only) under projects/{project_id}/{file_id}/v{version}/{name};
-- downloads are 10-minute signed URLs minted by the owner's route.

create table if not exists public.deed_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null check (owner_user_id ~ '^user_[A-Za-z0-9]{10,}$'),
  name text not null check (char_length(name) between 1 and 120),
  -- County slug as the rest of the app spells it (brevard, miami_dade, …).
  county text check (county ~ '^[a-z_]{2,40}$'),
  case_number text check (char_length(case_number) <= 80),
  parcel_id text check (char_length(parcel_id) <= 80),
  sale_date date,
  notes text not null default '' check (char_length(notes) <= 20000),
  -- S2/S5: where the project came from — {source, county, case, intent}.
  first_touch jsonb not null default '{}'::jsonb check (jsonb_typeof(first_touch) = 'object'),
  -- S1/S5: touched on every open; the greeting compares against it.
  last_viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deed_projects_owner_updated_idx
  on public.deed_projects (owner_user_id, updated_at desc);

alter table public.deed_projects enable row level security;
revoke all on table public.deed_projects from anon, authenticated;

create table if not exists public.deed_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.deed_projects (id) on delete cascade,
  owner_user_id text not null check (owner_user_id ~ '^user_[A-Za-z0-9]{10,}$'),
  filename text not null check (char_length(filename) between 1 and 255),
  mime_type text,
  size_bytes integer not null check (size_bytes >= 0 and size_bytes <= 20971520),
  -- Same filename uploaded again = the next version; older versions stay
  -- downloadable until deleted.
  version integer not null default 1 check (version >= 1),
  storage_path text not null check (storage_path like 'projects/%'),
  extracted_text text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('ok', 'unsupported', 'failed', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, filename, version)
);

create index if not exists deed_project_files_project_idx
  on public.deed_project_files (project_id, filename, version desc);

alter table public.deed_project_files enable row level security;
revoke all on table public.deed_project_files from anon, authenticated;

-- S1: "the properties / reports viewed" — what the customer attached to the
-- project by reference (a sale from the calendar, a parcel, a report, a
-- conversation). Labels are display text only; ref_id is the SSOT key.
create table if not exists public.deed_project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.deed_projects (id) on delete cascade,
  owner_user_id text not null check (owner_user_id ~ '^user_[A-Za-z0-9]{10,}$'),
  kind text not null check (kind in ('conversation', 'report', 'upload', 'parcel', 'sale')),
  ref_id text not null check (char_length(ref_id) between 1 and 120),
  label text check (char_length(label) <= 200),
  added_at timestamptz not null default now(),
  unique (project_id, kind, ref_id)
);

create index if not exists deed_project_items_project_idx
  on public.deed_project_items (project_id, added_at desc);

alter table public.deed_project_items enable row level security;
revoke all on table public.deed_project_items from anon, authenticated;

comment on table public.deed_projects is 'Deed Projects (PARITY CP-4, #19847): one property/bid per project, keyed on the Clerk sub. Service role only; every read is owner-scoped in app/api/deed/projects.';
comment on table public.deed_project_files is 'Project files (versioned; bytes in the private artifacts bucket under projects/{id}/, text extracted for Deed to cite). Service role only.';
comment on table public.deed_project_items is 'What a project references — sales, parcels, reports, conversations (S1 context). Service role only.';
