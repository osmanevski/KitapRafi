#!/usr/bin/env bash
#
# Deterministic structure check for the orchestration layer.
# No network, no model calls, no writes.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "FAIL: not inside a Git repository" >&2
  exit 1
fi

failed=0

note_fail() {
  echo "FAIL: $*" >&2
  failed=1
}

frontmatter_has() {
  local field="$1"
  local file="$2"
  sed -n '2,/^---$/p' "$file" | grep -Eq "^${field}:[[:space:]]*[^[:space:]]"
}

agents=(fable-orchestrator opus-implementer opus-reviewer)
for agent in "${agents[@]}"; do
  agent_file="$repo_root/.claude/agents/$agent.md"
  if [ ! -f "$agent_file" ]; then
    note_fail "missing agent definition .claude/agents/$agent.md"
    continue
  fi
  if [ "$(sed -n '1p' "$agent_file")" != "---" ]; then
    note_fail "agent definition must start with YAML frontmatter: $agent.md"
    continue
  fi
  for field in name model; do
    if ! frontmatter_has "$field" "$agent_file"; then
      note_fail "agent definition is missing '$field': $agent.md"
    fi
  done
done

fable_agent="$repo_root/.claude/agents/fable-orchestrator.md"
if [ -f "$fable_agent" ]; then
  sed -n '2,/^---$/p' "$fable_agent" | grep -Eq '^tools:.*\bAgent\b' ||
    note_fail "fable-orchestrator must expose the Agent tool"
  sed -n '2,/^---$/p' "$fable_agent" | grep -Eq '^model:[[:space:]]*fable[[:space:]]*$' ||
    note_fail "fable-orchestrator must pin model fable"
fi

reviewer_agent="$repo_root/.claude/agents/opus-reviewer.md"
if [ -f "$reviewer_agent" ]; then
  if sed -n '2,/^---$/p' "$reviewer_agent" | grep -Eq '^tools:.*\b(Write|Edit)\b'; then
    note_fail "opus-reviewer must not expose Write or Edit"
  fi
fi

skill_dir="$repo_root/.agents/skills/kitaprafi-orchestration"
for relative_path in "SKILL.md" "agents/openai.yaml"; do
  if [ ! -f "$skill_dir/$relative_path" ]; then
    note_fail "missing skill file .agents/skills/kitaprafi-orchestration/$relative_path"
  fi
done

scripts=(
  fable-orchestrate.sh
  hermes-review.sh
  orchestration-check.sh
  hermes-profile-setup.sh
)
for script in "${scripts[@]}"; do
  script_path="$repo_root/scripts/$script"
  if [ ! -f "$script_path" ]; then
    note_fail "missing script scripts/$script"
    continue
  fi
  if [ ! -x "$script_path" ]; then
    note_fail "script is not executable: scripts/$script"
  fi
  if ! bash -n "$script_path" 2>/dev/null; then
    note_fail "syntax error in scripts/$script"
  fi
done

review_script="$repo_root/scripts/hermes-review.sh"
if [ -f "$review_script" ]; then
  grep -Fq "HERMES_WRITE_SAFE_ROOT" "$review_script" ||
    note_fail "hermes-review.sh must set HERMES_WRITE_SAFE_ROOT"
  grep -Fq "openai-codex" "$review_script" ||
    note_fail "hermes-review.sh must pin provider openai-codex"
  grep -Fq 'HERMES_TOOLSETS="file,project"' "$review_script" ||
    note_fail "hermes-review.sh must restrict toolsets to file,project"
  grep -Fq -- '--usage-file' "$review_script" ||
    note_fail "hermes-review.sh must request native usage JSON"
  if grep -Eq '^[^#]*ANTHROPIC_API_KEY' "$review_script"; then
    note_fail "hermes-review.sh must never use ANTHROPIC_API_KEY"
  fi
  if grep -Eqi -- '--provider[[:space:]]+(anthropic|openrouter)' "$review_script"; then
    note_fail "hermes-review.sh must never activate Anthropic or OpenRouter"
  fi
  if grep -Eq -- '(^|[[:space:]])--yolo([[:space:]]|$)' "$review_script"; then
    note_fail "hermes-review.sh must never request yolo mode"
  fi
fi

orchestrate_script="$repo_root/scripts/fable-orchestrate.sh"
if [ -f "$orchestrate_script" ]; then
  grep -Fq -- "--authorize-paid-models" "$orchestrate_script" ||
    note_fail "fable-orchestrate.sh must require --authorize-paid-models"
  grep -Fq -- "--print" "$orchestrate_script" ||
    note_fail "fable-orchestrate.sh must use print mode for budget enforcement"
  grep -Fq -- "--max-budget-usd" "$orchestrate_script" ||
    note_fail "fable-orchestrate.sh must set a CLI budget ceiling"
fi

skill_metadata="$skill_dir/agents/openai.yaml"
if [ -f "$skill_metadata" ]; then
  grep -Fq 'default_prompt:' "$skill_metadata" ||
    note_fail "skill metadata must include a default_prompt"
fi

if [ ! -f "$repo_root/docs/agent/ORCHESTRATION.md" ]; then
  note_fail "missing docs/agent/ORCHESTRATION.md"
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "PASS: orchestration agents, skill, wrappers, and docs are present and valid"
