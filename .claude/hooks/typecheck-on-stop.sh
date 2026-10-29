#!/usr/bin/env bash
# Stop / SubagentStop: if TypeScript files changed, don't let the turn end
# while `tsc --noEmit` fails. Caches the last passing state per worktree, so
# an unchanged tree isn't re-checked on every turn.
set -uo pipefail

input=$(cat)
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
cwd=$(jq -r '.cwd // ""' <<<"$input")
cd "${cwd:-.}" 2>/dev/null || exit 0
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root"
[ -x node_modules/.bin/tsc ] || exit 0

changed=$(git status --porcelain --untracked-files=all -- '*.ts' '*.tsx' 2>/dev/null)
[ -n "$changed" ] || exit 0

stamp="$(git rev-parse --path-format=absolute --git-dir)/claude-typecheck-ok"
state=$( { git rev-parse HEAD; git diff HEAD -- '*.ts' '*.tsx'; git ls-files --others --exclude-standard -- '*.ts' '*.tsx' | xargs -r cat; } | sha1sum | cut -d' ' -f1)
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$state" ] && exit 0

if out=$(node_modules/.bin/tsc --noEmit 2>&1); then
  echo "$state" >"$stamp"
  exit 0
fi

jq -n --arg r "Typecheck fails (pnpm typecheck). Fix these before finishing, or say explicitly why you're leaving them:"$'\n'"$(head -40 <<<"$out")" \
  '{decision: "block", reason: $r}'
