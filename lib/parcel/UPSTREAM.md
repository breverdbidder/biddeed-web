# Parcel engine (vendored)

Source: `github.com/breverdbidder/parcel` (MIT, Copyright 2026 Everest Capital USA; see `LICENSE`).
Vendored 29 Sep 2026 from commit `8bb7431` (upstream `main`, "Retire the formula max bid: no Everest ceiling, no 70% rule").

These seven files are copied verbatim from upstream `src/`: `index.ts`, `types.ts`, `format.ts`,
`parse-listing.ts`, `samples.ts`, `underwrite.ts`, `biddeed.ts`. Do not edit them here; change
upstream and copy again, then run `npm run test:parcel`. They keep upstream's `.ts` import
extensions, which is why `tsconfig.json` sets `allowImportingTsExtensions` (the same files then
run under `node --experimental-strip-types` for the tests).

Not vendored: upstream `src/ui/`, `src/desk-store.ts`, `src/styles.css` and `tailwind.preset.js`.
They carry their own palette (paper / pine / clay, Fraunces / Outfit), which the biddeed.ai palette
gate refuses. The biddeed.ai desk is `components/parcel/ParcelDesk.tsx`, built on the site tokens.

What Parcel is on biddeed.ai: a second, local memo from the numbers the visitor types. It never
calls a model vendor, a BidDeed service or the network, and it is not the SIGNAL$ figure (which
stays withheld under `config/report-field-release.v1.json`). The call is labelled as the visitor's
own buy-box result.
