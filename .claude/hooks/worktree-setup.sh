#!/usr/bin/env bash
# Make a git worktree of this repo runnable: copy the gitignored local files
# from the main checkout and install dependencies from the pnpm store.
# Idempotent; does nothing in the main checkout. Usage: worktree-setup.sh [dir]
set -euo pipefail

dir="${1:-$PWD}"
cd "$dir"
[ -f package.json ] || exit 0

git_dir=$(git rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
[ "$git_dir" != "$common_dir" ] || exit 0 # main checkout
main=$(dirname "$common_dir")

# .worktreeinclude covers these for worktrees Claude Code creates; this also
# handles worktrees made with plain `git worktree add`.
for f in .env keptar.db; do
  [ -e "$f" ] || [ ! -e "$main/$f" ] || cp "$main/$f" "$f"
done
[ -e media ] || [ ! -d "$main/media" ] || cp -r "$main/media" media

if [ ! -d node_modules ]; then
  echo "worktree-setup: installing dependencies in $dir" >&2
  pnpm install --frozen-lockfile --prefer-offline >&2
fi
