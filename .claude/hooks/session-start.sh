#!/usr/bin/env bash
# SessionStart: set up a bare worktree and print a short state summary
# (stdout becomes context for Claude). Keep it fast.
set -uo pipefail

input=$(cat)
cwd=$(jq -r '.cwd // ""' <<<"$input")
cd "${cwd:-.}" 2>/dev/null || exit 0
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root"

"$(dirname "$0")/worktree-setup.sh" "$root" >/dev/null 2>&1 || true

branch=$(git branch --show-current)
where="main checkout"
[ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ] && where="worktree $root"
dirty=$(git status --porcelain | wc -l)
db="missing (run \`pnpm seed\`)"
[ -f keptar.db ] && db="present"
dev="not running"
curl -s -o /dev/null --max-time 1 http://localhost:3000/ && dev="running on http://localhost:3000"

echo "Képtár session: $where, branch $branch, $dirty uncommitted path(s). SQLite DB: $db. Dev server: $dev."
