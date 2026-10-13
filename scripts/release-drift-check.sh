#!/usr/bin/env bash
# Re-evaluation helper for docs/prod-release-plan.md.
# Read-only: fetches origin, compares dev vs main, and reports what changed since the
# baseline recorded in the plan. Does NOT touch Supabase or Vercel (see the plan's
# "Re-evaluation protocol" for the production migration-list check).
#
# Usage: scripts/release-drift-check.sh [baseline_dev_sha]   (default: baseline in the plan)
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_DEV="${1:-fe00667}"      # dev tip after the plan commit (code baseline 9e8dfaa, 2026-10-13)
BASE_MAIN="cba8cb8"           # main tip when the plan was written
BASE_MIGS=32                  # dev-only migrations at baseline

git fetch -q origin
DEV=$(git rev-parse --short origin/dev)
MAIN=$(git rev-parse --short origin/main)

echo "== tips: dev=$DEV (baseline $BASE_DEV)  main=$MAIN (baseline $BASE_MAIN)"
echo "== dev commits not on main: $(git rev-list --count origin/main..origin/dev)   main commits not on dev: $(git rev-list --count origin/dev..origin/main)"

if [ "$DEV" = "$BASE_DEV" ] && [ "$MAIN" = "$BASE_MAIN" ]; then
  echo "== no change since plan baseline; plan is current."
  exit 0
fi

echo
echo "== new commits on dev since baseline"
git log --format='%h %ad %s' --date=short "$BASE_DEV"..origin/dev 2>/dev/null || echo "(baseline sha not an ancestor of dev; history was rewritten, re-baseline manually)"

echo
echo "== migrations on dev not on main (baseline $BASE_MIGS)"
git diff --name-only --diff-filter=A origin/main origin/dev -- supabase/migrations | tee /dev/stderr | wc -l | xargs echo "count:"

echo
echo "== migrations added/changed since baseline (REVIEW EACH; changed ones may already be applied to sandbox)"
git diff --name-status "$BASE_DEV"..origin/dev -- supabase/migrations 2>/dev/null || true

echo
echo "== risky patterns in migrations added since baseline"
for f in $(git diff --name-only --diff-filter=AM "$BASE_DEV"..origin/dev -- supabase/migrations 2>/dev/null); do
  git show "origin/dev:$f" | grep -n -i -E "drop (table|column|function|type)|truncate|delete from|alter column .* type|rename|not null" | sed "s|^|$f: |" || true
done

echo
echo "== new env vars referenced in src since baseline"
git diff "$BASE_DEV"..origin/dev -- src 2>/dev/null | grep -o -E "process\.env\.[A-Z_]+" | sort -u || true

echo
echo "== files touching auth/gating since baseline"
git diff --name-only "$BASE_DEV"..origin/dev -- src/lib/supabase src/middleware.ts next.config.ts package.json 2>/dev/null || true

echo
echo "== merge conflicts if merged now"
git merge-tree --write-tree --name-only origin/main origin/dev 2>&1 | sed -n '2,$p' | grep -v '^$' | head -20 || true
