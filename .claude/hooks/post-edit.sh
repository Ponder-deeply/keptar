#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): lint the edited file (errors only) and
# remind about the follow-up steps a schema change needs.
set -uo pipefail

input=$(cat)
file=$(jq -r '.tool_input.file_path // ""' <<<"$input")
cwd=$(jq -r '.cwd // ""' <<<"$input")
[ -n "$file" ] && [ -f "$file" ] || exit 0

# Run from the checkout that contains the file (the main repo or a worktree).
root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || root="$cwd"
cd "$root" 2>/dev/null || exit 0

context=""
case "$file" in
  */src/collections/*.ts | */src/payload.config.ts)
    context="Schema file changed. Before finishing: run \`pnpm generate:types\` (and \`pnpm generate:importmap\` if admin components changed), update the Schema section of CLAUDE.md, adjust src/seed.ts if fields changed, and check the access rules with the access-auditor agent. See the schema-change skill." ;;
esac

case "$file" in
  *.ts | *.tsx | *.js | *.mjs | *.cjs | *.jsx)
    if [ -x node_modules/.bin/eslint ]; then
      if ! out=$(node_modules/.bin/eslint --quiet --no-warn-ignored "$file" 2>&1); then
        jq -n --arg r "ESLint errors in $file:"$'\n'"$out" --arg c "$context" \
          '{decision: "block", reason: $r} + (if $c == "" then {} else {hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}} end)'
        exit 0
      fi
    fi ;;
esac

if [ -n "$context" ]; then
  jq -n --arg c "$context" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}}'
fi
exit 0
