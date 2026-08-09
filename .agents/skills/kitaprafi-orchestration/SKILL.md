---
name: kitaprafi-orchestration
description: Operating rules for any coding harness (Claude Code, Codex CLI, Hermes) working in the Kitap Rafı repository. Use when planning, implementing, reviewing, or verifying changes here - it covers the task-card-before-edit workflow, branch and worktree isolation, protected data boundaries, the exact verification commands, and the required evidence artifacts.
---

# Kitaprafi Orchestration

## Overview

This repository coordinates human and agent work through tracked artifacts.
Any harness follows the same contract: read the rules, hold a task card, work
in an isolated branch, verify with the repository's own commands, and leave
evidence.

## 1. Read first

- `AGENTS.md` - required rules, project commands, protected boundaries. It is
  canonical for every harness, including Hermes (which prioritizes `AGENTS.md`
  over `CLAUDE.md`).
- `docs/agent/PROTOCOL.md` - roles, lifecycle, isolation, context envelopes,
  evidence rules.
- `docs/agent/ORCHESTRATION.md` - orchestrator/implementer/reviewer wiring,
  cost model, failure modes, glossary.

## 2. Task card before edit

No product file changes without a bounded card in
`docs/agent/plans/active/<task-id>.md`, created from
`docs/agent/templates/TASK.md`. The card names goal, non-goals, allowed change
scope, approval boundaries, acceptance criteria, and verification. Lifecycle:
`triage -> ready -> in_progress -> review -> accepted -> completed`.

## 3. Branch and worktree isolation

- `main`/`master` are integration branches; never write to them directly.
- Every concurrent writer gets a unique branch `agent/<task-id>` and its own
  worktree; record `branch` and `base_ref` in the card.
- Ports, containers, credentials, and live data are shared unless the card
  defines isolated replacements.

## 4. Verification

Run what the change touches, and record the real exit status:

```bash
node --check server.js               # server syntax
node scripts/test-parse.js           # parser smoke test
bash scripts/agent-protocol-check.sh # protocol artifacts and task semantics
bash scripts/orchestration-check.sh  # orchestration layer structure
bash -n <changed-shell-script>
```

There is no general `npm test`. Do not invent tests or deploy procedures;
discover commands from repository evidence.

## 5. Protected boundaries

- `data/` - canonical book and author JSON; stateful, change only when the card
  requires it.
- `uploads/` - persistent Docker volume for covers; do not copy, delete, or
  normalize.
- `.env`, `.env.*` - secrets (`ADMIN_KEY`, provider keys); never read into
  agent artifacts, never print, never commit.
- `n8n-workflow.json` - external automation boundary; editing the file does not
  authorize writing to the live n8n instance.
- Deployment, PM2, Docker, SSH, and service restarts need explicit human
  authorization. Capability never implies authority.

## 6. Evidence artifacts

- `docs/agent/handoffs/<task-id>.md` (from `templates/HANDOFF.md`) is required
  before `status: review`; it carries the changed-artifact list and a
  verification table with actual results.
- `docs/agent/reviews/<task-id>-<n>.md` (from `templates/REVIEW.md`) with
  `verdict: pass` is required before `accepted` or `completed`. The reviewer
  must be a different session from the implementer, preferably a different
  provider.
- Keep secrets, credentials, and raw transcripts out of tracked artifacts;
  summarize and link instead.
