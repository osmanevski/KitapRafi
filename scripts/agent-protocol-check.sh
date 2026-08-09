#!/usr/bin/env bash

set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "FAIL: not inside a Git repository" >&2
  exit 1
fi

required_files=(
  "AGENTS.md"
  "CLAUDE.md"
  "docs/agent/PROTOCOL.md"
  "docs/agent/templates/TASK.md"
  "docs/agent/templates/HANDOFF.md"
  "docs/agent/templates/REVIEW.md"
)
required_dirs=(
  "docs/agent/plans/active"
  "docs/agent/plans/completed"
  "docs/agent/handoffs"
  "docs/agent/reviews"
)

failed=0
for relative_path in "${required_files[@]}"; do
  if [ ! -f "$repo_root/$relative_path" ]; then
    echo "FAIL: missing $relative_path" >&2
    failed=1
  fi
done
for relative_path in "${required_dirs[@]}"; do
  if [ ! -d "$repo_root/$relative_path" ]; then
    echo "FAIL: missing directory $relative_path" >&2
    failed=1
  fi
done

if [ -f "$repo_root/CLAUDE.md" ] && \
   [ "$(sed -n '1p' "$repo_root/CLAUDE.md")" != "@AGENTS.md" ]; then
  echo "FAIL: CLAUDE.md must import @AGENTS.md on its first line" >&2
  failed=1
fi

frontmatter_value() {
  local field="$1"
  local file="$2"
  awk -v wanted="$field" '
    NR == 1 && $0 != "---" { exit }
    NR > 1 && $0 == "---" { exit }
    NR > 1 && index($0, wanted ":") == 1 {
      sub(/^[^:]*:[[:space:]]*/, "")
      print
      exit
    }
  ' "$file"
}

has_field() {
  local field="$1"
  local file="$2"
  if command -v rg >/dev/null 2>&1; then
    sed -n '2,/^---$/p' "$file" | rg -q "^${field}:"
  else
    sed -n '2,/^---$/p' "$file" | grep -Eq "^${field}:"
  fi
}

validate_task() {
  local file="$1"
  local placement="$2"
  local field id status risk branch blocked_on filename review passing_review

  if [ "$(sed -n '1p' "$file")" != "---" ] || \
     [ -z "$(awk 'NR > 1 && $0 == "---" { print NR; exit }' "$file")" ]; then
    echo "FAIL: task must have closed frontmatter: $file" >&2
    failed=1
  fi

  for field in id status risk owner orchestrator implementer reviewer branch \
    base_ref blocked_on created updated; do
    if ! has_field "$field" "$file"; then
      echo "FAIL: task is missing '$field': $file" >&2
      failed=1
    fi
  done

  id="$(frontmatter_value id "$file")"
  status="$(frontmatter_value status "$file")"
  risk="$(frontmatter_value risk "$file")"
  branch="$(frontmatter_value branch "$file")"
  blocked_on="$(frontmatter_value blocked_on "$file")"
  filename="$(basename "$file" .md)"

  if [ -z "$id" ] || [ "$id" != "$filename" ]; then
    echo "FAIL: task filename must match its id: $file" >&2
    failed=1
  fi
  case "$status" in
    triage|ready|in_progress|review|accepted|completed|blocked) ;;
    *) echo "FAIL: invalid task status '$status': $file" >&2; failed=1 ;;
  esac
  case "$risk" in
    low|medium|high|critical) ;;
    *) echo "FAIL: invalid task risk '$risk': $file" >&2; failed=1 ;;
  esac
  if [ "$placement" = active ] && [ "$status" = completed ]; then
    echo "FAIL: completed task remains active: $file" >&2
    failed=1
  fi
  if [ "$placement" = completed ] && [ "$status" != completed ]; then
    echo "FAIL: archived task is not completed: $file" >&2
    failed=1
  fi
  if [ "$status" = blocked ]; then
    case "$blocked_on" in
      ""|none|unassigned)
        echo "FAIL: blocked task must identify blocked_on: $file" >&2
        failed=1
        ;;
    esac
  fi
  case "$status" in
    in_progress|review)
      case "$branch" in
        ""|unassigned|main|master)
          echo "FAIL: writing task needs a non-integration branch: $file" >&2
          failed=1
          ;;
      esac
      ;;
  esac
  case "$status" in
    review|accepted|completed)
      if [ ! -f "$repo_root/docs/agent/handoffs/$id.md" ]; then
        echo "FAIL: $status task is missing handoff: $id" >&2
        failed=1
      fi
      ;;
  esac
  case "$status" in
    accepted|completed)
      passing_review=0
      while IFS= read -r review; do
        if [ "$(frontmatter_value verdict "$review")" = pass ]; then
          passing_review=1
        fi
      done < <(find "$repo_root/docs/agent/reviews" -maxdepth 1 -type f \
        -name "$id-*.md" -print 2>/dev/null)
      if [ "$passing_review" -ne 1 ]; then
        echo "FAIL: $status task requires an independent pass review: $id" >&2
        failed=1
      fi
      ;;
  esac
}

for placement in active completed; do
  task_dir="$repo_root/docs/agent/plans/$placement"
  if [ -d "$task_dir" ]; then
    while IFS= read -r file; do
      validate_task "$file" "$placement"
    done < <(find "$task_dir" -maxdepth 1 -type f -name '*.md' -print)
  fi
done

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "PASS: agent protocol structure and task semantics are valid"
