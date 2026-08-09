---
id: TASK-20260809-002-hermes-fable-orchestration
status: review
risk: medium
owner: human
orchestrator: Fable 5 (Claude Code)
implementer: Opus (opus-implementer subagent)
reviewer: Opus (opus-reviewer subagent), cross-check Hermes/Codex once configured
branch: agent/TASK-20260809-002-hermes-fable-orchestration
base_ref: main
blocked_on: none
created: 2026-08-09
updated: 2026-08-09
---

# Repository-local Fable/Opus/Hermes orchestration layer

## Goal

A repository-local orchestration layer exists: Claude Code agent definitions for
an orchestrator plus implementer and reviewer subagents, a cross-harness skill,
four safe shell wrappers, and an architecture document. Product behavior is
unchanged and no agent binary is executed.

## Non-goals

- Changing product behavior (`server.js`, `public/`, `data/`, `uploads/`,
  product scripts in `package.json`).
- Deployment, PM2, Docker, SSH, or live service actions.
- Writing global or user-level configuration, Hermes profiles, or MCP servers.
- Running the Hermes binary, OAuth flows, or any network call.
- Committing or pushing; the orchestrator owns integration.

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
- `docs/agent/ORCHESTRATION.md`, task card, handoff.
- `AGENTS.md` source map and project commands (additive lines only).
- `docs/agent/PROTOCOL.md`: at most one pointer line.

## Constraints and approval boundaries

- Hermes must never run Fable or Opus through native Anthropic and must never
  use an Anthropic API key: native Anthropic OAuth needs Claude Max plus extra
  credits, and an API key bills per token. Fable 5 runs only in Claude Code.
- Hermes runs only with provider `openai-codex` over ChatGPT/Codex subscription
  OAuth. No fallback to OpenRouter, Anthropic, or any key-billed provider; the
  wrappers fail closed instead.
- Exact Hermes flag spellings are unverified; every wrapper that touches
  `hermes` probes `hermes --help` at runtime and exits non-zero when a needed
  construct is absent.
- Paid Claude model launches require an explicit `--authorize-paid-models`
  acknowledgment and a budget ceiling.
- No secrets: never read or print `.env*` or credentials; usage JSON is written
  outside the repository.
- No commit, push, merge, or deploy from this task.

## Dependencies

- Human runs the interactive Hermes authentication and profile creation; the
  setup wrapper only prints the plan.
- `python3` with `PyYAML` for skill validation.

## Acceptance criteria

- [ ] `.claude/agents/{fable-orchestrator,opus-implementer,opus-reviewer}.md`
      exist with valid frontmatter.
- [ ] `.agents/skills/kitaprafi-orchestration/SKILL.md` and
      `agents/openai.yaml` exist and validate.
- [ ] Four wrappers exist, are executable, and pass `bash -n`.
- [ ] `bash scripts/orchestration-check.sh` and
      `bash scripts/agent-protocol-check.sh` pass.
- [ ] `node --check server.js` and `node scripts/test-parse.js` still pass.
- [ ] `docs/agent/ORCHESTRATION.md` documents roles, commands, cost, failure
      modes, and glossary without inventing Hermes flags.
- [ ] Diff has no unrelated or product changes.

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
  read-only by construction: write-capable toolsets disabled plus a
  `HERMES_WRITE_SAFE_ROOT` sentinel outside the repository.
- `AGENTS.md` stays canonical for Hermes; no `.hermes.md` is created.
- Blocked: the session permission system refused writes to `.claude/`, so the
  three agent definitions are missing and `scripts/orchestration-check.sh` fails
  on exactly those files. See the handoff for the exact refusal.
