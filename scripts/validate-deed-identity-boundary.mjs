#!/usr/bin/env node

/**
 * Static D10 regression gate.
 *
 * Deed persistence is authorized only by the Clerk session `sub`. This gate
 * makes the trust boundary reviewable on every PR, before the authenticated
 * two-user Playwright suite proves it against a deployed environment.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const persistenceRoots = ['threads', 'upload', 'citations', 'projects'].map((name) =>
  path.join(root, 'app', 'api', 'deed', name)
)

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(full) : full.endsWith('.ts') ? [full] : []
  })
}

const files = persistenceRoots.flatMap(filesUnder)
const failures = []

for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isStringLiteralLike(node)) {
      const value = node.text.toLowerCase()
      if (value === 'x-chat-token' || value === 'owner_email') {
        failures.push(`${path.relative(root, file)} trusts forbidden client identity field ${JSON.stringify(node.text)}`)
      }
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'email') {
      const receiver = node.expression.getText(source)
      if (/\b(body|request|req|input|payload)\b/i.test(receiver)) {
        failures.push(`${path.relative(root, file)} reads client-supplied email via ${node.getText(source)}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

const identityRoute = path.join(root, 'app', 'api', 'deed', 'identity')
if (fs.existsSync(identityRoute)) failures.push('legacy /api/deed/identity issuer exists')

const serverFile = path.join(root, 'lib', 'deed', 'server.ts')
const server = fs.readFileSync(serverFile, 'utf8')
for (const required of [
  "import { auth, currentUser } from '@clerk/nextjs/server'",
  'userId = (await auth()).userId',
  'ctx: { userId, supabase: getRetryingSupabaseClient(key) }',
]) {
  if (!server.includes(required)) failures.push(`lib/deed/server.ts lost required Clerk boundary: ${required}`)
}

const migrationFiles = [
  'supabase/migrations/20260917200000_deed_threads_verified_identity.sql',
  'supabase/migrations/20260917233000_deed_projects.sql',
]
for (const relative of migrationFiles) {
  const sql = fs.readFileSync(path.join(root, relative), 'utf8').toLowerCase()
  if (!sql.includes('owner_user_id text not null')) failures.push(`${relative} is not keyed by owner_user_id`)
  if (!sql.includes('enable row level security')) failures.push(`${relative} does not enable RLS`)
  if (!sql.includes('revoke all')) failures.push(`${relative} does not revoke direct table access`)
  if (/create\s+policy/i.test(sql)) failures.push(`${relative} adds a direct RLS policy; service-only default-deny is required`)
}

if (failures.length) {
  console.error('D10 Clerk identity boundary FAILED:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`D10 Clerk identity boundary passed: ${files.length} persistence route files use the server-verified Clerk sub; legacy email/token identity is absent; service-only tables remain RLS default-deny.`)
