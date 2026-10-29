#!/usr/bin/env bash
# PreToolUse(Bash): bootstrap bare worktrees before pnpm runs, and block
# commands that leak secrets or destroy data that can't be recreated.
set -uo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
cwd=$(jq -r '.cwd // ""' <<<"$input")
cd "${cwd:-.}" 2>/dev/null || exit 0

deny() {
  jq -n --arg r "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

# Secrets: .env holds the Instagram token and API keys.
if grep -Eq '(^|[;&|[:space:]])(cat|less|more|head|tail|bat|grep|rg|sed|awk|xxd|strings|base64)\b[^;&|]*[[:space:]/]\.env([[:space:]]|$|[;&|])' <<<"$cmd"; then
  deny "Reading .env would print secrets into the transcript. List the keys with \`cut -d= -f1 .env\`, or test one with \`grep -q '^NAME=.' .env && echo set\`."
fi

# Seeding and migration resets wipe the database; refuse them against Postgres (production).
if grep -Eq '(pnpm|npm|npx)[[:space:]].*(\bseed\b|migrate:(fresh|reset|down))' <<<"$cmd"; then
  db_url="${DATABASE_URL:-}"
  [ -n "$db_url" ] || db_url=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | tail -1 | cut -d= -f2-)
  if [[ "$db_url" =~ ^[\"\']?postgres ]]; then
    deny "DATABASE_URL points at Postgres; this command would wipe it. Seeding and migration resets are for the local SQLite database only. Ask the user to run it themselves if they really mean it."
  fi
fi

if grep -Eq 'git[[:space:]]+push\b.*(--force\b|--force-with-lease|[[:space:]]-[a-zA-Z]*f)' <<<"$cmd"; then
  deny "Force-push is not allowed from Claude. Ask the user."
fi

# A fresh worktree has no node_modules; set it up before the first pnpm/npx/tsc call.
if [ -f package.json ] && [ ! -d node_modules ] \
  && grep -Eq '(^|[;&|[:space:]])(pnpm|npx|node_modules/\.bin/)' <<<"$cmd" \
  && ! grep -Eq 'pnpm[[:space:]]+(i|install|add)\b' <<<"$cmd"; then
  "$(dirname "$0")/worktree-setup.sh" "$PWD" >/dev/null 2>&1 || true
fi

exit 0
