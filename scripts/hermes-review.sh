#!/usr/bin/env bash
# Run a read-only Hermes review through ChatGPT/Codex subscription OAuth.

set -euo pipefail

readonly HERMES_PROFILE="kitaprafi"
readonly HERMES_PROVIDER="openai-codex"
readonly HERMES_MODEL="gpt-5.6-sol"
readonly HERMES_TOOLSETS="file,project"

usage() {
  cat >&2 <<'EOF'
Usage: scripts/hermes-review.sh <prompt-file> [--out <usage-json-path>]

  <prompt-file>  Required review envelope. Its content is passed as one CLI
                 argument without eval or shell interpolation.
  --out <path>   Optional absolute usage-report path outside the repository.
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
    --help|-h) usage; exit 0 ;;
    --out)
      [ "$#" -ge 2 ] || fail "--out needs a path"
      usage_json="$2"
      shift 2
      ;;
    -*) fail "unknown argument '$1'" ;;
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
[ "$(wc -c <"$prompt_file")" -le 200000 ] || fail "prompt file exceeds 200000 bytes"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$repo_root" ] || fail "not inside a Git repository"
command -v hermes >/dev/null 2>&1 || fail "'hermes' binary not found in PATH"

hermes profile list | grep -Eq "(^|[[:space:]])${HERMES_PROFILE}([[:space:]]|$)" ||
  fail "Hermes profile '$HERMES_PROFILE' is missing; run scripts/hermes-profile-setup.sh --apply"

configured_provider="$(hermes --profile "$HERMES_PROFILE" config get model.provider 2>/dev/null || true)"
[ "$configured_provider" = "$HERMES_PROVIDER" ] ||
  fail "profile provider is '$configured_provider', expected '$HERMES_PROVIDER'"

fallback_output="$(hermes --profile "$HERMES_PROFILE" fallback list 2>/dev/null || true)"
if printf '%s\n' "$fallback_output" | grep -Eqi 'anthropic|openrouter|^[[:space:]]*[0-9]+[.)]'; then
  fail "profile has a fallback provider; clear it before review"
fi

hermes --profile "$HERMES_PROFILE" auth status "$HERMES_PROVIDER" >/dev/null 2>&1 ||
  fail "'$HERMES_PROVIDER' OAuth is unavailable; authenticate interactively"

if [ -n "$usage_json" ]; then
  case "$usage_json" in
    /*) ;;
    *) fail "--out must be an absolute path" ;;
  esac
  usage_parent="$(dirname "$usage_json")"
  [ -d "$usage_parent" ] || fail "--out parent directory does not exist: $usage_parent"
  usage_json="$(cd "$usage_parent" && pwd -P)/$(basename "$usage_json")"
else
  usage_json="$(mktemp "${TMPDIR:-/tmp}/hermes-review-usage.XXXXXX.json")"
fi
case "$usage_json" in
  "$repo_root"|"$repo_root"/*) fail "--out must point outside the repository" ;;
esac

write_sentinel="$(mktemp -d "${TMPDIR:-/tmp}/hermes-review-safe-root.XXXXXX")"
transcript="$(mktemp "${TMPDIR:-/tmp}/hermes-review-transcript.XXXXXX")"
cleanup() {
  case "$write_sentinel" in
    "${TMPDIR:-/tmp}"/hermes-review-safe-root.*) rm -rf "$write_sentinel" ;;
  esac
}
trap cleanup EXIT

export HERMES_WRITE_SAFE_ROOT="$write_sentinel"
prompt="$(<"$prompt_file")"

echo "Harness:  hermes (profile $HERMES_PROFILE)"
echo "Provider: $HERMES_PROVIDER (ChatGPT/Codex subscription OAuth)"
echo "Model:    $HERMES_MODEL"
echo "Toolsets: $HERMES_TOOLSETS (terminal/delegation/memory/skills absent)"
echo "Safe root: $HERMES_WRITE_SAFE_ROOT"

set +e
hermes \
  --profile "$HERMES_PROFILE" \
  --in "$repo_root" \
  -z "$prompt" \
  --usage-file "$usage_json" \
  --provider "$HERMES_PROVIDER" \
  --model "$HERMES_MODEL" \
  --reasoning high \
  --toolsets "$HERMES_TOOLSETS" \
  | tee "$transcript"
status="${PIPESTATUS[0]}"
set -e

echo "Transcript: $transcript"
echo "Usage JSON: $usage_json"
exit "$status"
