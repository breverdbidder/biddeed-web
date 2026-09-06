#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://biddeed.ai}"
OUT_DIR="${OUT_DIR:-artifacts/critical-ui-gates}"
mkdir -p "$OUT_DIR"

printf '%s\n' '== TypeScript =='
pnpm exec tsc --noEmit

printf '%s\n' '== Source palette canon =='
node scripts/palette-gate.mjs

printf '%s\n' '== HTTP route smoke =='
for route in / /radar /discover /auctions /sign-in /sign-up /buy-report; do
  status="$(curl -L -sS -o /dev/null -w '%{http_code}' "$BASE_URL$route")"
  printf '%-16s %s\n' "$route" "$status"
  case "$route" in
    /|/radar|/discover|/sign-in|/sign-up|/buy-report) test "$status" = 200 ;;
    /auctions) test "$status" = 200 ;;
  esac
done

printf '%s\n' '== Standalone Playwright critical UI gates =='
BASE_URL="$BASE_URL" OUT_DIR="$OUT_DIR" node scripts/ui-audit/critical-gates.mjs || true

printf '%s\n' '== Audit harness, both viewports =='
python3 ../cli-anything-biddeed-repo/scripts/ui-audit/audit.py \
  --base "$BASE_URL" \
  --routes ../cli-anything-biddeed-repo/scripts/ui-audit/routes.json \
  --out "$OUT_DIR/ui-audit.md" || true

printf '%s\n' "Artifacts written to $OUT_DIR"
