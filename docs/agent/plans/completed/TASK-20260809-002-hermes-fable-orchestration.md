---
id: TASK-20260809-002-hermes-fable-orchestration
status: completed
risk: medium
owner: human
orchestrator: Fable 5 (Claude Code)
implementer: Opus (opus-implementer subagent)
reviewer: Hermes / openai-codex / gpt-5.6-sol (independent rounds 1-3)
branch: agent/TASK-20260809-002-hermes-fable-orchestration
base_ref: main
blocked_on: none
created: 2026-08-09
updated: 2026-08-09
---

# Repository-local Fable/Opus/Hermes orchestration layer

## Goal

A repository-local orchestration layer exists: Claude Code agent definitions for
a Fable orchestrator plus Opus implementer and reviewer subagents, a
cross-harness skill, four safe shell wrappers, and an architecture document.
Hermes has an isolated `kitaprafi` profile using ChatGPT/Codex OAuth for
independent read-only review. Product behavior is unchanged.

## Non-goals

- Changing product behavior (`server.js`, `public/`, `data/`, `uploads/`,
  product scripts in `package.json`).
- Deployment, PM2, Docker, SSH, or live service actions.
- Installing or changing Hermes, Claude Code, Codex CLI, or MCP servers.
- Changing the user's default Hermes profile or enabling a paid-provider
  fallback.
- Self-authorized commits, merge, acceptance, push, or deployment. The human
  retains authority; Fable may coordinate or recommend these actions only.

## Context entry points

- `AGENTS.md`: required rules, project commands, protected boundaries.
- `docs/agent/PROTOCOL.md`: roles, isolation, context envelopes, evidence.
- `docs/agent/templates/{TASK,HANDOFF,REVIEW}.md`: artifact formats.
- `scripts/agent-protocol-check.sh`: existing deterministic gate and script tone.
- Environment facts: Hermes Agent v0.20.0 at `~/.local/bin/hermes` (not
  executable from the task sandbox), Claude Code 2.1.226, Codex CLI 0.147.0,
  Claude Pro (not Max), ChatGPT/Codex OAuth available for provider
  `openai-codex`.

## Allowed change scope

- `.claude/agents/` (new agent definitions).
- `.agents/skills/kitaprafi-orchestration/` (new cross-harness skill).
- `scripts/fable-orchestrate.sh`, `scripts/hermes-review.sh`,
  `scripts/orchestration-check.sh`, `scripts/hermes-profile-setup.sh`.
- `docs/agent/ORCHESTRATION.md`, task card, handoff, and independent review
  artifacts for this task.
- `AGENTS.md` source map and project commands (additive lines only).
- `docs/agent/PROTOCOL.md`: at most one pointer line.

## Constraints and approval boundaries

- Hermes must never run Fable or Opus through native Anthropic and must never
  use an Anthropic API key: native Anthropic OAuth needs Claude Max plus extra
  credits, and an API key bills per token. Fable 5 runs only in Claude Code.
- Hermes runs only with provider `openai-codex` over ChatGPT/Codex subscription
  OAuth. No fallback to OpenRouter, Anthropic, or any key-billed provider; the
  wrappers fail closed instead.
- Hermes v0.20.0 flag spellings and profile commands are verified against the
  installed CLI. Wrappers still fail closed when required profile state or
  credentials are absent.
- Paid Claude model launches require an explicit `--authorize-paid-models`
  acknowledgment and a budget ceiling.
- No secrets: never read or print `.env*` or credentials; usage JSON is written
  outside the repository.
- No agent may authorize a commit, merge, acceptance, push, or deploy. A local
  commit or fast-forward integration may be executed only under the human's
  explicit instruction; push and deployment remain outside this task.

## Dependencies

- Human authorization for Hermes profile creation and interactive OAuth.
- `python3` with `PyYAML` for skill validation.

## Acceptance criteria

- [x] `.claude/agents/{fable-orchestrator,opus-implementer,opus-reviewer}.md`
      exist with valid frontmatter.
- [x] `.agents/skills/kitaprafi-orchestration/SKILL.md` and
      `agents/openai.yaml` exist and validate.
- [x] Four wrappers exist, are executable, and pass `bash -n`.
- [x] `bash scripts/orchestration-check.sh` and
      `bash scripts/agent-protocol-check.sh` pass.
- [x] `node --check server.js` and `node scripts/test-parse.js` still pass.
- [x] `docs/agent/ORCHESTRATION.md` documents roles, commands, cost, failure
      modes, and glossary without inventing Hermes flags.
- [x] Diff has no unrelated or product changes.
- [x] Independent Hermes/Codex review has a tracked `verdict: pass` artifact.

## Verification

```text
bash -n scripts/fable-orchestrate.sh
bash -n scripts/hermes-review.sh
bash -n scripts/orchestration-check.sh
bash -n scripts/hermes-profile-setup.sh
bash scripts/agent-protocol-check.sh
bash scripts/orchestration-check.sh
node --check server.js
node scripts/test-parse.js
python3 /Users/osmanevski/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  .agents/skills/kitaprafi-orchestration
```

## Progress and decisions

- Hermes is treated as an isolated supporting harness for read-only review, not
  as a delegation API; its MCP server is a messaging bridge only.
- The `-z` one-shot mode auto-bypasses approvals, so the review wrapper is
  read-only by construction: only the `file` toolset plus a
  `HERMES_WRITE_SAFE_ROOT` sentinel outside the repository.
- `AGENTS.md` stays canonical for Hermes; no `.hermes.md` is created.
- Fable 5 orchestrated the repository implementation through Claude Code and
  delegated file implementation to the `opus-implementer` subagent.
- The initial implementation was corrected after deterministic inspection:
  agent files now live in `.claude/agents/`; Fable uses `Agent`; the Claude
  wrapper uses `--print`; Hermes receives `-z` as an argument; the dedicated
  profile pins `openai-codex` / `gpt-5.6-sol` with no fallback.
- The user authorized creation of the isolated Hermes profile and the OpenAI
  device OAuth flow. Authentication completed successfully; the default Hermes
  profile was not changed.
- Hermes/Codex r1 reviewed `f45dc15..6ccd0c3` and returned `blocked` with four
  actionable findings. Commit `8d3590f` attempted their closure; r2 confirmed
  authority and handoff evidence, but required stronger fallback and path
  checks.
- Hermes/Codex r2 reviewed `f45dc15..8da14b4`. Human authority and immutable
  evidence refs closed; exact full-output fallback matching and pre-creation
  path rejection remained blocked and are remediated in the next commit.
- Hermes/Codex r3 reviewed `f45dc15..a13f9a7` and returned `pass` with no new
  blockers. Native usage reported subscription-included cost status and zero
  estimated USD cost.
