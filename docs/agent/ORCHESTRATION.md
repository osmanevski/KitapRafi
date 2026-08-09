# Orchestration

How models, harnesses, and wrappers are wired for this repository. Rules come
from `AGENTS.md` and `docs/agent/PROTOCOL.md`; this file only describes the
tooling that implements them.

## Overview

- **Orchestrator**: Fable 5 running in Claude Code as the top-level session.
  Read-mostly. Decomposes work into task cards, routes workers, summarizes.
  Definition: `.claude/agents/fable-orchestrator.md`.
- **Implementer**: Opus subagent, one bounded task on one branch and worktree.
  Definition: `.claude/agents/opus-implementer.md`.
- **Reviewer**: Opus subagent, independent and read-only.
  Definition: `.claude/agents/opus-reviewer.md`.
- **Cross-provider reviewer**: Hermes harness with provider `openai-codex` over
  ChatGPT/Codex subscription OAuth. It is an isolated supporting harness for
  read-only review, not a delegation backend. Wrapper:
  `scripts/hermes-review.sh`.
- **Portable rules**: `.agents/skills/kitaprafi-orchestration/` carries the same
  operating contract to any harness that loads skills.

Fable and Opus run only in Claude Code. Hermes must never run them, because
native Anthropic access through Hermes requires Claude Max plus extra credits
and an Anthropic API key bills per token. The account here is Claude Pro.

## Commands

```bash
# Orchestrator session (paid Claude models; acknowledgment required)
scripts/fable-orchestrate.sh --authorize-paid-models --budget-usd 5 -- "goal text"

# Cross-provider read-only review (prompt is a file, never interpolated)
scripts/hermes-review.sh /tmp/review-prompt.md --out /tmp/review-usage.json

# Print or apply the isolated profile configuration; OAuth stays a human step
scripts/hermes-profile-setup.sh
scripts/hermes-profile-setup.sh --apply
hermes --profile kitaprafi auth add openai-codex --type oauth

# Deterministic gates
bash scripts/orchestration-check.sh
bash scripts/agent-protocol-check.sh
node --check server.js
node scripts/test-parse.js
```

`scripts/fable-orchestrate.sh` runs from the repository root in non-interactive
print mode so `--max-budget-usd` is effective. It keeps project settings, uses
no bare mode or permission bypass, refuses Anthropic API credentials, verifies
Claude subscription login, and executes the `fable-orchestrator` agent.

## Context envelopes

Per `docs/agent/PROTOCOL.md`:

- Orchestrator receives goal, architecture map, task graph, decisions, and
  concise handoffs.
- Implementer receives one task card, the relevant rules and files, protected
  boundaries, and the required checks.
- Reviewer receives the original task, the diff or commit, the relevant rules,
  and the verification evidence.

Full worker transcripts and unrestricted logs never flow into the parent
context. Workers link to repository evidence (`docs/agent/handoffs/`,
`docs/agent/reviews/`) and detail is loaded progressively. The Hermes wrapper
writes its transcript and usage JSON to temporary paths outside the repository
and prints those paths.

## Token and cost accounting

| Path | Billing | Control |
|---|---|---|
| Fable 5 and Opus in Claude Code | Claude subscription | API credentials rejected; `--authorize-paid-models` plus `--max-budget-usd` (default 5) |
| Hermes with `openai-codex` | ChatGPT/Codex subscription OAuth, not per token | profile pinned to one provider, no fallbacks |
| Anthropic through Hermes | prohibited | needs Claude Max plus credits, or a per-token API key; wrappers never set an Anthropic key |

No wrapper may fall back to OpenRouter, Anthropic, or any other key-billed
provider. Missing capability is an error, never a downgrade.

## Failure modes

- **Missing Hermes binary, profile, or `openai-codex` auth**:
  `scripts/hermes-review.sh` exits non-zero with a clear message. The
  orchestrator falls back to the `opus-reviewer` subagent.
- **One-shot approval bypass**: Hermes one-shot (`-z`) mode auto-bypasses
  approvals. The review wrapper therefore enables only the `file` toolset.
  Terminal, delegation, memory, skill, and desktop-project tools are absent, while
  `HERMES_WRITE_SAFE_ROOT` points to a throwaway directory outside the repo so
  file writes to the worktree are hard-blocked.
- **Budget exhaustion**: the Claude session stops at `--max-budget-usd`. Rerun
  with a larger, explicitly acknowledged ceiling; do not disable the gate.
- **Reviewer unavailable**: use `opus-reviewer`. A task still needs a different
  session for review than for implementation. A blocked review is evidence of an
  attempt, not acceptance.
- **Profile setup**: `scripts/hermes-profile-setup.sh` is dry-run by default.
  `--apply` writes only the dedicated profile configuration, never starts OAuth,
  never reads or prints credentials, and never touches Anthropic keys.
  Authentication remains an explicit interactive human step.
- **Usage output path**: an explicit `--out` target must not exist. Its physical
  parent is resolved and repository paths are rejected before creation; then the
  file is reserved with noclobber before Hermes starts. Existing files and
  symbolic links fail. The physical temporary root must also be outside the
  repository before any default output, transcript, or safe-root is created.

## Glossary

- **Model**: the weights answering a request, for example Fable 5, Opus, or a
  Codex model. Choosing a model does not choose a harness.
- **Harness**: the runtime that hosts a session and its tools, for example
  Claude Code, Codex CLI, or the Hermes agent runtime. Instructions,
  permissions, and tool availability are harness-level.
- **MCP**: a protocol for exposing tools to a model. The Hermes MCP server
  exposes messaging-bridge tools only; it is not a general agent-delegation or
  worker API. The worker interface here is the CLI wrapper.
- **Skill**: a portable instruction package under `.agents/skills/`, loadable by
  multiple harnesses (Hermes reads external skill directories via
  `skills.external_dirs`). A skill grants guidance, not authority.
- **Memory**: harness-local persistent notes. In Hermes, memory writes are
  approval-gated; they are session tooling and never project truth. Repository
  state outranks any memory.
- **Worker**: a session doing bounded implementation under one task card, one
  branch, and one worktree.
- **Reviewer**: an independent read-only session, different from the
  implementer and preferably a different model or provider.
- **Authority**: the human owner. Capability never implies authority: an
  available tool, skill, MCP server, or credential does not widen a task card,
  and sessions never approve each other's destructive or external actions.

`AGENTS.md` is canonical for every harness, including Hermes, which prioritizes
it over `CLAUDE.md`. Do not add a `.hermes.md`.
