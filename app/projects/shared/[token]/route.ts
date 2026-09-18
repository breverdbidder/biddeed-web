import { NextRequest, NextResponse } from 'next/server'

import { FILES_BUCKET, SHARE_TOKEN_RE } from '@/lib/deed/projects'
import { getRetryingSupabaseClient } from '@/lib/supabase-retry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /projects/shared/{token} — a shared project file (PARITY CP-4 PR B,
 * #19847 DoD 3: "share link 200 then 404 after revoke").
 *
 * Why this path and not /r/{token}: biddeed.ai is fronted by the router Worker
 * (cli-anything-biddeed src/worker.js), which owns /r/<code> for the reel
 * short-links and only proxies an allowlist of prefixes to this app.
 * /projects/* is on that allowlist; /r/* is not, so a share link under /r
 * answered the router's own 404 on the canonical domain (PR C, 2026-09-18).
 *
 * Public by design: whoever holds the link gets the bytes of that one file
 * version, served through this route (never a storage URL) with the owner's
 * file name, `noindex`, and no caching. Anything else — unknown token,
 * revoked share, deleted file or project, columns not migrated yet — is the
 * same 404, so the response never says which.
 */

const INLINE = new Set(['application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json', 'image/png', 'image/jpeg', 'image/webp'])

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!SHARE_TOKEN_RE.test(token)) return notFound()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) return notFound()
  const supabase = getRetryingSupabaseClient(key)

  const { data: file, error } = await supabase
    .from('deed_project_files')
    .select('id,filename,mime_type,size_bytes,storage_path,share_revoked_at,share_views')
    .eq('share_token', token)
    .maybeSingle<{ id: string; filename: string; mime_type: string | null; size_bytes: number; storage_path: string; share_revoked_at: string | null; share_views: number | null }>()
  if (error || !file || file.share_revoked_at) return notFound()

  const { data: blob, error: dlError } = await supabase.storage.from(FILES_BUCKET).download(file.storage_path)
  if (dlError || !blob) return notFound()

  // Count the view; a failure here must never turn a good link into a 404.
  try {
    await supabase.from('deed_project_files').update({ share_views: (file.share_views ?? 0) + 1 }).eq('id', file.id)
  } catch {
    /* ignore */
  }

  const type = file.mime_type || 'application/octet-stream'
  const asciiName = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'")
  const disposition = `${INLINE.has(type) ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`
  return new NextResponse(blob.stream(), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(file.size_bytes),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
