/**
 * Ambient types for '@clerk/testing/playwright'.
 *
 * The package is deliberately NOT in package.json (see playwright-rls.yml —
 * it is installed fresh with `npm install --no-save` only in the E2E job), so
 * `npm run typecheck` on a plain `npm ci` tree cannot resolve the module and
 * PR production validation fails on tests/e2e/*.spec.ts (run 35291867105).
 *
 * This declaration mirrors dist/types/playwright/setupClerkTestingToken.d.ts
 * of @clerk/testing 2.2.36 exactly, so the specs type-check with or without
 * the package present and nothing about the E2E job changes.
 */
declare module '@clerk/testing/playwright' {
  import type { BrowserContext, Page } from '@playwright/test'

  export type SetupClerkTestingTokenOptions = {
    frontendApiUrl?: string
  }

  export type SetupClerkTestingTokenParams = {
    context?: BrowserContext
    page?: Page
    options?: SetupClerkTestingTokenOptions
  }

  /** Bypasses bot protection by appending the testing token to Frontend API requests. */
  export const setupClerkTestingToken: (params: SetupClerkTestingTokenParams) => Promise<void>
}
