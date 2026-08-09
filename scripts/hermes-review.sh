#!/usr/bin/env bash
#
# Read-only cross-provider review worker: Hermes harness, provider openai-codex
# over the ChatGPT/Codex subscription OAuth session.
#
# Hardening:
#   * prompt is read from a file and handed over stdin, never interpolated into
#     a command line;
#   * exact Hermes flag spellings are unverified, so every construct is probed
#     in `hermes --help` at runtime and the script fails closed when missing;
#   * one-shot mode auto-bypasses approvals, so write capability is removed by
#     construction: write-capable toolsets are disabled and
#     HERMES_WRITE_SAFE_ROOT points at a throwaway sentinel outside the repo;
#   * no fallback provider is ever attempted; no Anthropic key is ever used.
#
# Usage:
#   scripts/hermes-review.sh <prompt-file> [--out <usage-json-path>]

set -euo pipefail

readonly HERMES_PROFILE="kitaprafi"
readonly HERMES_PROVIDER="openai-codex"
readonly HERMES_MODEL="gpt-5-codex"
readonly DISABLED_TOOLSETS="terminal,delegation,memory-write,skill-write"

usage() {
  cat >&2 <<'EOF'
Usage: scripts/hermes-review.sh <prompt-file> [--out <usage-json-path>]

  <prompt-file>          File containing the review prompt (read, not interpolated).
  --out <path>           Where to write the usage/cost JSON. Must be outside the
                         repository; defaults to a temporary file.
EOF
}

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

prompt_file=""
usage_json=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --out)
      [ "$#" -ge 2 ] || fail "--out needs a path"
      usage_json="$2"
      shift 2
      ;;
    -*)
      usage
      fail "unknown argument '$1'"
      ;;
    *)
      [ -z "$prompt_file" ] || fail "only one prompt file is accepted"
      prompt_file="$1"
      shift
      ;;
  esac
done

[ -n "$prompt_file" ] || { usage; fail "a prompt file is required"; }
[ -f "$prompt_file" ] || fail "prompt file not found: $prompt_file"
[ -s "$prompt_file" ] || fail "prompt file is empty: $prompt_file"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || fail "not inside a Git repository"

command -v hermes >/dev/null 2>&1 || fail "'hermes' binary not found in PATH"

help_text="$(hermes --help 2>&1 || true)"
[ -n "$help_text" ] || fail "'hermes --help' produced no output; cannot verify flags"

# Resolve one construct from a list of candidate spellings, or fail closed.
resolve_flag() {
  local description="$1"
  shift
  local candidate
  for candidate in "$@"; do
    if printf '%s\n' "$help_text" | grep -Fq -- "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  echo "FAIL: 'hermes --help' does not expose $description (tried: $*)." >&2
  echo "      Refusing to guess a flag spelling. Re-run after confirming the" >&2
  echo "      construct in 'hermes --help'." >&2
  return 1
}

missing=0
oneshot_flag="$(resolve_flag "one-shot mode" "-z")" || missing=1
profile_flag="$(resolve_flag "profile selection" "--profile")" || missing=1
provider_flag="$(resolve_flag "provider selection" "--provider")" || missing=1
model_flag="$(resolve_flag "model selection" "--model")" || missing=1
toolset_flag="$(resolve_flag "toolset disabling" \
  "--disable-toolset" "--disable-toolsets" "--no-toolset")" || missing=1
[ "$missing" -eq 0 ] || fail "required Hermes constructs are unavailable"

# The profile must already exist. Creating or authenticating it is an explicit
# interactive human step (see scripts/hermes-profile-setup.sh).
profile_listing="$(hermes profile list 2>/dev/null || hermes profiles 2>/dev/null || true)"
if [ -z "$profile_listing" ]; then
  fail "cannot enumerate Hermes profiles; configure the '$HERMES_PROFILE' profile first (scripts/hermes-profile-setup.sh)"
fi
printf '%s\n' "$profile_listing" | grep -Fq -- "$HERMES_PROFILE" ||
  fail "Hermes profile '$HERMES_PROFILE' is not configured; run scripts/hermes-profile-setup.sh and authenticate interactively"

auth_status="$(hermes auth status 2>/dev/null || true)"
if [ -z "$auth_status" ]; then
  fail "cannot read Hermes auth status; authenticate '$HERMES_PROVIDER' interactively first"
fi
printf '%s\n' "$auth_status" | grep -Fq -- "$HERMES_PROVIDER" ||
  fail "no '$HERMES_PROVIDER' authentication found; this wrapper never falls back to another provider"

# Write sentinel outside the repository. Anything the model still tries to write
# lands here and is discarded with the temp dir.
write_sentinel="$(mktemp -d "${TMPDIR:-/tmp}/hermes-review-safe-root.XXXXXX")"
transcript="$(mktemp "${TMPDIR:-/tmp}/hermes-review-transcript.XXXXXX")"
if [ -z "$usage_json" ]; then
  usage_json="$(mktemp "${TMPDIR:-/tmp}/hermes-review-usage.XXXXXX.json")"
fi
case "$usage_json" in
  "$repo_root"/*) fail "--out must point outside the repository" ;;
esac

cleanup() {
  rm -rf "$write_sentinel"
}
trap cleanup EXIT

export HERMES_WRITE_SAFE_ROOT="$write_sentinel"

echo "Harness:  hermes (profile $HERMES_PROFILE)"
echo "Provider: $HERMES_PROVIDER (ChatGPT/Codex subscription OAuth)"
echo "Model:    $HERMES_MODEL"
echo "Mode:     read-only one-shot; toolsets disabled: $DISABLED_TOOLSETS"
echo "Safe root: $HERMES_WRITE_SAFE_ROOT"

set +e
hermes \
  "$oneshot_flag" \
  "$profile_flag" "$HERMES_PROFILE" \
  "$provider_flag" "$HERMES_PROVIDER" \
  "$model_flag" "$HERMES_MODEL" \
  "$toolset_flag" "$DISABLED_TOOLSETS" \
  <"$prompt_file" | tee "$transcript"
status="${PIPESTATUS[0]}"
set -e

printf '{\n' >"$usage_json"
printf '  "profile": "%s",\n' "$HERMES_PROFILE" >>"$usage_json"
printf '  "provider": "%s",\n' "$HERMES_PROVIDER" >>"$usage_json"
printf '  "model": "%s",\n' "$HERMES_MODEL" >>"$usage_json"
printf '  "billing": "chatgpt-codex-subscription-oauth",\n' >>"$usage_json"
printf '  "disabled_toolsets": "%s",\n' "$DISABLED_TOOLSETS" >>"$usage_json"
printf '  "write_safe_root": "%s",\n' "$write_sentinel" >>"$usage_json"
printf '  "transcript": "%s",\n' "$transcript" >>"$usage_json"
printf '  "exit_status": %s\n' "$status" >>"$usage_json"
printf '}\n' >>"$usage_json"

echo "Transcript: $transcript"
echo "Usage JSON: $usage_json"

exit "$status"
