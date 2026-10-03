#!/usr/bin/env bash
# CI-Skript: lint, typecheck, unit- und Integrationstests (Integrationstests nur mit TEST_DATABASE_URL).
# Mit E2E=1 zusätzlich Build + Playwright.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> lint";      npm run lint
echo "==> typecheck"; npm run typecheck
echo "==> test";      npm test
if [ "${E2E:-0}" = "1" ]; then
  echo "==> build";   npm run build
  echo "==> e2e";     npm run test:e2e
fi
echo "CI OK"
