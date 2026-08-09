#!/usr/bin/env bash
#
# Plan (and only on request attempt) the local Hermes 'kitaprafi' profile.
#
# Dry-run by default: it prints the intended configuration and the interactive
# command the human must run. Authentication is always an explicit human step;
# this script never runs OAuth, never reads or prints credentials, and never
# touches Anthropic keys.
#
# Usage:
#   scripts/hermes-profile-setup.sh            # print the plan (default)
#   scripts/hermes-profile-setup.sh --apply    # probe hermes, fail closed if unsure

set -euo pipefail

readonly HERMES_PROFILE="kitaprafi"
readonly HERMES_PROVIDER="openai-codex"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

apply=0
case "${1-}" in
  "") ;;
  --apply) apply=1 ;;
  --help|-h)
    cat >&2 <<'EOF'
Usage: scripts/hermes-profile-setup.sh [--apply]

  (no flags)  Dry run: print the intended profile plan and the interactive
              authentication command for the human to run.
  --apply     Probe 'hermes --help' for the exact config/profile subcommands and
              fail closed if they cannot be confirmed. Never runs OAuth.
EOF
    exit 0
    ;;
  *) fail "unknown argument '${1}'" ;;
esac

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || fail "not inside a Git repository"

cat <<EOF
Hermes profile plan: $HERMES_PROFILE
====================================

Purpose
  Isolated supporting harness for read-only cross-provider review of this
  repository. It never runs Fable or Opus.

Providers
  primary provider          : $HERMES_PROVIDER (ChatGPT/Codex subscription OAuth)
  auxiliary / small model   : $HERMES_PROVIDER (same subscription OAuth)
  fallback providers        : none
  rationale                 : every path must bill against the ChatGPT
                              subscription. Anthropic via Hermes is prohibited:
                              native Anthropic OAuth needs Claude Max plus extra
                              credits, and an Anthropic API key bills per token.
                              No OpenRouter or other key-billed provider.

Skills
  skills.external_dirs      : .agents/skills (repository-relative)
                              absolute form on this machine:
                              $repo_root/.agents/skills

Approvals and toolsets
  smart approvals           : on
  memory writes             : approval required
  skill writes              : approval required
  review sessions           : run through scripts/hermes-review.sh, which
                              disables the terminal, delegation, memory-write and
                              skill-write toolsets and sets HERMES_WRITE_SAFE_ROOT
                              to a throwaway directory outside the repository,
                              because one-shot (-z) mode auto-bypasses approvals.

Instructions file
  AGENTS.md stays canonical. Do not create .hermes.md.

Authentication (interactive human step, NOT run by this script)
  hermes auth login --provider $HERMES_PROVIDER

  Run it yourself in your own terminal and complete the ChatGPT/Codex OAuth flow.
  This script never starts OAuth, never opens a browser, and never reads or
  prints tokens. Confirm the exact subcommand spelling with 'hermes --help'.
EOF

if [ "$apply" -eq 0 ]; then
  cat <<'EOF'

Dry run only. Nothing was changed. Re-run with --apply to probe the Hermes CLI.
EOF
  exit 0
fi

echo
echo "Probing 'hermes --help' for the constructs needed to apply this plan..."

command -v hermes >/dev/null 2>&1 || fail "'hermes' binary not found in PATH"

help_text="$(hermes --help 2>&1 || true)"
[ -n "$help_text" ] || fail "'hermes --help' produced no output; cannot confirm subcommands"

missing=()
for construct in "config" "profile" "auth"; do
  if ! printf '%s\n' "$help_text" | grep -Fq -- "$construct"; then
    missing+=("$construct")
  fi
done

if [ "${#missing[@]}" -ne 0 ]; then
  echo "FAIL: could not confirm these Hermes constructs in 'hermes --help':" >&2
  for construct in "${missing[@]}"; do
    echo "  - $construct" >&2
  done
  echo "      Refusing to guess CLI spellings. Apply the plan above manually." >&2
  exit 1
fi

cat <<EOF

'hermes --help' mentions config, profile and auth, but this script still does not
write configuration on your behalf: exact subcommand argument spellings for
profile creation are not verified in this repository, and guessing them could
create a profile with a paid fallback provider.

Apply the plan above manually, then verify with:
  bash scripts/hermes-review.sh <prompt-file>

Authentication remains an explicit interactive human step.
EOF
exit 1
