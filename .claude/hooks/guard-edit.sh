#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit): protect generated files,
# secrets, the lockfile and Dimitrij's vision doc, and enforce the frozen
# schema for subagents (CLAUDE.md: only the orchestrating session edits it).
set -uo pipefail

input=$(cat)
file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
agent_id=$(jq -r '.agent_id // ""' <<<"$input")

deny() {
  jq -n --arg r "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

case "$file" in
  */src/payload-types.ts | */src/payload-generated-schema.ts)
    deny "$file is generated. Change the collection config and run \`pnpm generate:types\`." ;;
  */src/app/\(payload\)/admin/importMap.js)
    deny "importMap.js is generated. Run \`pnpm generate:importmap\`." ;;
  */pnpm-lock.yaml)
    deny "Don't hand-edit the lockfile. Use \`pnpm add\` / \`pnpm remove\`." ;;
  */.env | */.env.local | */.env.*.local)
    deny "Claude doesn't write secrets files. Tell the user which variable to set; document new ones in .env.example." ;;
  */DIMI1.md)
    deny "DIMI1.md is Dimitrij's vision document and is read-only. Record decisions in Képtár.md instead." ;;
  */src/collections/*.ts | */src/payload.config.ts)
    if [ -n "$agent_id" ]; then
      deny "The schema is frozen for agents (CLAUDE.md). Don't edit $file; report the change you need (collection, field, access rule, reason) in your final message so the orchestrating session can make it."
    fi ;;
esac

exit 0
