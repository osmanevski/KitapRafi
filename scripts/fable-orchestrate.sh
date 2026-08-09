#!/usr/bin/env bash
#
# Launch Fable orchestration in Claude Code for this repository.
#
# Fable and the Opus subagents bill against the Claude subscription or API, so
# this wrapper refuses to run without an explicit paid-model acknowledgment and
# always passes a budget ceiling.
#
# Usage:
#   scripts/fable-orchestrate.sh --authorize-paid-models [--budget-usd N] [-- <prompt>]

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: scripts/fable-orchestrate.sh --authorize-paid-models [--budget-usd N] [-- <prompt>]

  --authorize-paid-models  Required first argument. Acknowledges that Fable and
                           Opus calls are billed to the Claude subscription or
                           Anthropic API.
  --budget-usd N           Session ceiling passed to --max-budget-usd (default 5).
  -- <prompt>              Optional prompt text handed to Claude Code.
EOF
}

model="claude-fable-5"
agent="fable-orchestrator"
budget="5"

if [ "$#" -eq 0 ] || [ "$1" != "--authorize-paid-models" ]; then
  echo "FAIL: refusing to start. Fable and Opus are paid models billed to the" >&2
  echo "      Claude subscription or Anthropic API; pass --authorize-paid-models" >&2
  echo "      as the first argument to acknowledge the cost." >&2
  usage
  exit 1
fi
shift

prompt=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --budget-usd)
      if [ "$#" -lt 2 ]; then
        echo "FAIL: --budget-usd needs a value" >&2
        exit 1
      fi
      budget="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      prompt="$*"
      break
      ;;
    *)
      echo "FAIL: unknown argument '$1'" >&2
      usage
      exit 1
      ;;
  esac
done

case "$budget" in
  ''|*[!0-9.]*|.|*.*.*)
    echo "FAIL: --budget-usd must be a positive number, got '$budget'" >&2
    exit 1
    ;;
esac

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "FAIL: not inside a Git repository" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "FAIL: 'claude' CLI not found in PATH" >&2
  exit 1
fi

if [ ! -f "$repo_root/.claude/agents/$agent.md" ]; then
  echo "FAIL: missing agent definition .claude/agents/$agent.md" >&2
  exit 1
fi

cd "$repo_root"

# Project settings stay in effect: no --bare and no permission bypass.
set -- --agent "$agent" --model "$model" --max-budget-usd "$budget"
if [ -n "$prompt" ]; then
  set -- "$@" "$prompt"
fi

echo "Repo:    $repo_root"
echo "Budget:  \$$budget (--max-budget-usd)"
printf 'Command: claude'
for argument in "$@"; do
  printf ' %q' "$argument"
done
printf '\n'

exec claude "$@"
