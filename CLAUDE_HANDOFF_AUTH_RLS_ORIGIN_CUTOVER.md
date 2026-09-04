# BidDeed.ai — Claude Execution Handoff

> **Instruction:** Execute this handoff directly. Do not ask the BidDeed owner to perform engineering tasks. Use the repository’s existing independent Cloudflare/OpenNext architecture. Do not inject Manus infrastructure, services, dependencies, telemetry, or credentials.

## Objective

Close the final authentication, two-user RLS, and production-origin blockers for `biddeed.ai`.

## Already implemented in this branch

- `playwright.config.ts` exists.
- `tests/e2e/rls-isolation.spec.ts` signs in two independent Clerk browser contexts and verifies Saved Search and Watchlist ownership, cross-user read denial, cross-user mutation denial, and owner cleanup.
- `.github/workflows/playwright-rls.yml` is a manual staging workflow and uploads Playwright evidence.
- `npm run test:e2e:rls` is available.
- `CLERK_RUNTIME_ENABLED=true` has been enabled in the synchronization workflow.
- `npm run build` passes.
- Current direct production checks pass for:
  - `GET https://biddeed.ai/buy-report` → HTTP 200.
  - `GET https://biddeed.ai/buy-report/counties` → HTTP 200 JSON.
  - `GET https://biddeed.ai/buy-report/auctions?county=brevard` → HTTP 200 JSON.
  - `POST https://biddeed.ai/buy-report/checkout` with `{}` → HTTP 400 JSON `email required`.
- `https://staging.biddeed.ai/sign-in` renders the interactive Clerk form.
- `https://biddeed.ai/sign-in` still renders the fallback “Sign-in is not configured on this deployment.”

## External operations that must be completed

### 1. Provision test identities without exposing credentials

Use the Clerk staging instance to create two dedicated non-production password users. Do not enable an MFA or verification flow that cannot be completed by automation. Do not place credentials in source, logs, issues, or chat.

Add the following masked GitHub Actions repository or staging-environment secrets to `breverdbidder/biddeed-web`:

```text
E2E_USER_A_EMAIL
E2E_USER_A_PASSWORD
E2E_USER_B_EMAIL
E2E_USER_B_PASSWORD
```

Do not print values. Do not commit them.

### 2. Execute the authenticated RLS suite

Run the workflow:

```text
.github/workflows/playwright-rls.yml
```

Use:

```text
E2E_BASE_URL=https://staging.biddeed.ai
```

The run is accepted only if the following assertions pass:

1. User A signs in successfully.
2. User A creates a Saved Search.
3. User A creates a Watchlist item.
4. User B signs in in a separate browser context.
5. User B’s Saved Search list does not contain User A’s record.
6. User B’s Watchlist list does not contain User A’s record.
7. User B receives HTTP 404 when attempting to patch User A’s Saved Search.
8. User B receives HTTP 404 when attempting to delete User A’s Watchlist item.
9. User A can delete/archive both records.
10. Playwright HTML report, trace, response evidence, and cleanup evidence are uploaded.

If Clerk presents a verification or MFA challenge, stop and fix the staging test identities/configuration. Do not weaken application security to bypass it.

### 3. Activate Clerk on the production application origin

The production origin must use the same Clerk-enabled OpenNext runtime as staging.

Bind the following to the production OpenNext Worker using encrypted Cloudflare secret bindings:

```text
CLERK_SECRET_KEY
```

Set the non-secret build/runtime configuration:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_RUNTIME_ENABLED=true
```

The secret and publishable key must belong to the same Clerk production instance. The secret key must never reach browser bundles or logs.

In Clerk production settings, allow:

```text
https://biddeed.ai
https://www.biddeed.ai
```

Only retain `www` if it is an active canonical hostname. Ensure sign-in/sign-up redirect URLs point to the production hostname.

### 4. Unify Cloudflare route ownership without breaking `/buy-report`

Do not send all paths to the OpenNext Worker until it owns an equivalent `/buy-report` implementation. The current production commercial route is Worker-owned and returns HTTP 200.

Maintain this route matrix until an intentional migration is verified:

```text
/sign-in, /sign-up, /account/*  -> Clerk-enabled OpenNext Worker
/radar, /discover, /alerts       -> Clerk-enabled OpenNext Worker
/api/*                           -> certified OpenNext/API owner
/buy-report, /buy-report/*       -> current Worker commercial owner
/report/*, /success              -> explicitly tested owner
/_next/*, RSC, images, maps      -> same owner as their page runtime
```

Record and verify the exact Cloudflare Worker name, commit SHA, route pattern, route priority, DNS state, and response headers. The apex domain—not only a `workers.dev` URL—is the certification target.

### 5. Production verification after activation

Run these checks from the production hostname:

```text
GET /sign-in
GET /sign-up
GET /radar
GET /discover
GET /alerts
GET /buy-report
GET /buy-report/counties
GET /buy-report/auctions?county=brevard
GET /api/health
```

Acceptance conditions:

- `/sign-in` renders the interactive Clerk form, not the fallback configuration message.
- Signed-out responses expose no secret material.
- CSP allows only the required Clerk, Mapbox, Stripe, Supabase, and voice origins.
- `/buy-report` remains HTTP 200.
- `/buy-report/counties` and `/buy-report/auctions` remain HTTP 200 JSON.
- RSC/static assets/maps load on the canonical hostname.
- Cloudflare logs show the certified Worker as the application origin.
- A reversible rollback target is documented and tested.

### 6. Produce the final evidence record

Update the sprint roadmap with:

- Clerk production activation result.
- Playwright run URL and artifact name.
- RLS isolation verdict.
- Exact production Worker deployment ID and commit SHA.
- Route matrix and rollback target.
- Any remaining gaps.

Do not declare 100% PropertyOnion parity or enterprise readiness unless the RLS test, S5 report entitlement test, provider gates, data freshness gate, security/dependency gate, and Cloudflare origin gate all pass.

## Hard constraints

- No Manus infrastructure or Manus lock-in.
- No production database weakening.
- No disabling RLS.
- No secret values in source, output, or commits.
- No false “passed” claims when a test is skipped or blocked.
- Preserve the WinnerDataAI cream, terracotta, and black-ink design system.
