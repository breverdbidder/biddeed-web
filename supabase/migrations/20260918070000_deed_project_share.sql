-- PARITY CP-4 PR B — share links for project files (issue #19847 DoD 3:
-- "share link 200 then 404 after revoke").
--
-- PROPOSAL, not applied: schema changes are signed by the owner (meta prompt
-- 0.10). Apply against mocerqjnksmhcjzxrewo with the service role; until then
-- the share routes answer 503 "not configured" and /r/{token} answers 404 —
-- nothing else in Projects changes (the file columns below are selected only
-- by the share code, never by the file list).
--
-- MODEL. A share is a property of ONE stored file version: the owner mints a
-- random token (43 chars, 256 bits), /r/{token} serves that version's bytes
-- to anyone who holds the link, and revoking sets share_revoked_at so the
-- same link answers 404 from then on. The token stays on the row after a
-- revoke (audit); a new share mints a new token. No identity, project id or
-- file id ever appears in the public URL.
--
-- Generated reports (JSON / CSV / PDF versions of a project) are ordinary
-- rows of deed_project_files — same versioning, download and share rules —
-- referenced from deed_project_items with kind = 'report'. No new table.

alter table public.deed_project_files
  add column if not exists share_token text check (share_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  add column if not exists shared_at timestamptz,
  add column if not exists share_revoked_at timestamptz,
  add column if not exists share_views integer not null default 0 check (share_views >= 0);

create unique index if not exists deed_project_files_share_token_idx
  on public.deed_project_files (share_token) where share_token is not null;

comment on column public.deed_project_files.share_token is 'Public share token for /r/{token} (PARITY CP-4 PR B). Random, 43 chars. Kept after revoke; a new share mints a new token.';
comment on column public.deed_project_files.share_revoked_at is 'Set when the owner revokes the share; /r/{token} answers 404 from then on.';
comment on column public.deed_project_files.share_views is 'Times /r/{token} served the bytes.';
