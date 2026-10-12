#!/usr/bin/env bash
# PostToolUse hook: format and lint-fix the file Claude just wrote/edited.
set -euo pipefail

file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s||"{}");process.stdout.write((j.tool_response&&j.tool_response.filePath)||(j.tool_input&&j.tool_input.file_path)||"")})')"
[ -n "$file" ] && [ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

case "$file" in
  */node_modules/*|*/android/*|*/ios/*|*/.expo/*) exit 0 ;;
esac

case "$file" in
  *.js|*.jsx|*.ts|*.tsx)
    npx --no-install eslint --fix "$file" >/dev/null 2>&1 || true
    npx --no-install prettier --write --ignore-unknown "$file" >/dev/null
    ;;
  *.json|*.md|*.yml|*.yaml)
    npx --no-install prettier --write --ignore-unknown "$file" >/dev/null
    ;;
esac
