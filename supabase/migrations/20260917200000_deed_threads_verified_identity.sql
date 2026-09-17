-- PARITY CP-3 — verified identity for Deed chat (C2b, gate D10).
--
-- PROPOSAL, not applied: schema changes are signed by the owner (meta prompt
-- 0.10). Apply against mocerqjnksmhcjzxrewo with the service role, then the
-- routes under app/api/deed/threads* and app/api/deed/upload start answering
-- 200 instead of 503 "not configured" — no redeploy needed.
--
-- WHY NEW TABLES. The legacy biddeed_chat_conversations / _messages /
-- _uploads / biddeed_projects rows are keyed on owner_email — an email the
-- Worker took on the visitor's word (a one-time code on the Worker, never
-- the account boundary). That is the issue #20226 containment: nothing reads
-- those rows any more, and nothing here migrates them (5 conversations, 10
-- messages, 18 uploads — all test traffic). These tables are keyed on the
-- Clerk `sub` that app/api/* verifies server-side with auth(); an email is
-- never an identity here.
--
-- ACCESS MODEL. Row-level security is ON with NO policies and every grant to
-- anon / authenticated revoked: only the service role — the Next.js routes —
-- can touch these rows, and every query in those routes carries
-- `.eq('owner_user_id', auth().userId)`. The cc-runner RLS gate reads this as
-- a service-only table (no anon path), same class as stripe.*.

create table if not exists public.deed_threads (
  -- The client's own 12-character thread id (lib/deed/threads.ts newId), so
  -- /chat?c=<id> keeps working across the anonymous → signed-in boundary.
  id text primary key check (id ~ '^[A-Za-z0-9_-]{6,40}$'),
  owner_user_id text not null check (owner_user_id ~ '^user_[A-Za-z0-9]{10,}$'),
  title text not null default 'New conversation' check (char_length(title) <= 120),
  project_id text,
  -- The Worker's own conversation id for this thread, once known (issue
  -- #19829 P1) — reused so the Worker-side persistence lands in one row.
  worker_conversation_id text,
  -- ThreadTurn[] as the client holds it, minus transient fields (pending,
  -- streaming). Capped by the route at 60 turns / 200 KB.
  turns jsonb not null default '[]'::jsonb check (jsonb_typeof(turns) = 'array'),
  -- Plain-text concatenation of the turns, written by the route on every
  -- upsert, so thread search is one tsvector index and no jsonb walking.
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deed_threads_owner_updated_idx
  on public.deed_threads (owner_user_id, updated_at desc);

create index if not exists deed_threads_search_idx
  on public.deed_threads using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(search_text, '')));

alter table public.deed_threads enable row level security;
revoke all on table public.deed_threads from anon, authenticated;

create table if not exists public.deed_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null check (owner_user_id ~ '^user_[A-Za-z0-9]{10,}$'),
  thread_id text references public.deed_threads (id) on delete set null,
  filename text not null check (char_length(filename) <= 255),
  mime_type text,
  size_bytes integer not null check (size_bytes >= 0 and size_bytes <= 8388608),
  -- Only the extracted text is kept — Deed cites text, not bytes. Files as
  -- files (versions, signed-URL download) are CP-4's Projects layer.
  extracted_text text,
  extraction_status text not null default 'pending'
    check (extraction_status in ('ok', 'unsupported', 'failed', 'pending')),
  created_at timestamptz not null default now()
);

create index if not exists deed_uploads_owner_created_idx
  on public.deed_uploads (owner_user_id, created_at desc);

alter table public.deed_uploads enable row level security;
revoke all on table public.deed_uploads from anon, authenticated;

comment on table public.deed_threads is 'Deed chat threads keyed on the Clerk sub (PARITY CP-3). Service role only; every read is owner-scoped in app/api/deed/threads.';
comment on table public.deed_uploads is 'Deed chat uploads (extracted text) keyed on the Clerk sub (PARITY CP-3). Service role only.';
