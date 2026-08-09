#!/usr/bin/env bash
# Configure a dedicated Hermes profile without starting OAuth or reading secrets.

set -euo pipefail

readonly HERMES_PROFILE="kitaprafi"
readonly HERMES_PROVIDER="openai-codex"
readonly HERMES_MODEL="gpt-5.6-sol"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: scripts/hermes-profile-setup.sh [--apply]

  (no flags)  Print the exact plan without changing user configuration.
  --apply     Create/update the isolated profile. OAuth remains a separate,
              explicit interactive command.
EOF
}

apply=0
case "${1-}" in
  "") ;;
  --apply) apply=1 ;;
  --help|-h) usage; exit 0 ;;
  *) fail "unknown argument '${1}'" ;;
esac

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || fail "not inside a Git repository"

cat <<EOF
Hermes profile plan: $HERMES_PROFILE
====================================
Provider/model : $HERMES_PROVIDER / $HERMES_MODEL
Runtime        : Hermes tool loop (not Codex app-server migration)
Fallbacks      : none
Auxiliary LLMs : explicitly routed to $HERMES_PROVIDER
Skill source   : $repo_root/.agents/skills
Approvals      : smart; memory and skill writes require approval
Instructions   : AGENTS.md remains canonical; no .hermes.md

No API key is added or inspected. Anthropic and OpenRouter are not configured.
OAuth is deliberately separate and interactive:

  hermes --profile $HERMES_PROFILE auth add $HERMES_PROVIDER --type oauth
EOF
if [ "$apply" -eq 0 ]; then
  echo
  echo "Dry run only. Nothing was changed."
  exit 0
fi

command -v hermes >/dev/null 2>&1 || fail "'hermes' binary not found in PATH"

if ! hermes profile list | grep -Eq "(^|[[:space:]])${HERMES_PROFILE}([[:space:]]|$)"; then
  hermes profile create "$HERMES_PROFILE" \
    --no-skills \
    --description "Read-only cross-provider review for the Kitaprafi repository"
fi

profile_config() {
  hermes --profile "$HERMES_PROFILE" config set "$1" "$2"
}

profile_config model.provider "$HERMES_PROVIDER"
profile_config model.default "$HERMES_MODEL"
profile_config model.openai_runtime auto
profile_config model.base_url ""
profile_config auxiliary.free_only true
profile_config auxiliary.title_generation.enabled false
profile_config approvals.mode smart
profile_config memory.write_approval true
profile_config skills.write_approval true
profile_config skills.guard_agent_created true
profile_config skills.external_dirs.0 "$repo_root/.agents/skills"

# Every auxiliary LLM route is explicit so a stale OpenRouter/API key cannot be
# selected by the automatic resolver.
auxiliary_tasks=(
  vision web_extract compression skills_hub approval mcp
  memory_query_rewrite tts_audio_tags triage_specifier kanban_decomposer
  profile_describer goal_judge curator monitor background_review
  moa_reference moa_aggregator
)
for auxiliary_task in "${auxiliary_tasks[@]}"; do
  profile_config "auxiliary.${auxiliary_task}.provider" "$HERMES_PROVIDER"
done

hermes --profile "$HERMES_PROFILE" fallback clear

cat <<EOF

Profile configuration applied. No OAuth flow was started and no credential was
read. Complete the interactive subscription login yourself:

  hermes --profile $HERMES_PROFILE auth add $HERMES_PROVIDER --type oauth

Then verify:

  hermes --profile $HERMES_PROFILE auth status $HERMES_PROVIDER
  scripts/hermes-review.sh /absolute/path/to/review-prompt.md
EOF
