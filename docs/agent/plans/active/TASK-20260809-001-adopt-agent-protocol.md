---
id: TASK-20260809-001-adopt-agent-protocol
status: review
risk: medium
owner: osmanevski
orchestrator: codex
implementer: codex
reviewer: fable
branch: agent/TASK-20260809-001-adopt-agent-protocol
base_ref: a12c76c761a393793fd8e8c074ee86bad6108f04
blocked_on: none
created: 2026-08-09
updated: 2026-08-09
---

# Adopt the agent-development protocol

## Goal

Add a minimal, provider-neutral agent workflow that lets fresh Codex and Claude
Code sessions find Kitap Rafı's boundaries, own isolated tasks, hand off evidence,
and receive independent review without relying on chat history.

## Non-goals

- Do not change product behavior or dependencies.
- Do not modify `server.js`, `public/`, `data/`, `uploads/`, automation, Docker,
  deployment, or live services.
- Do not install global skills, MCP servers, hooks, or orchestration products.
- Do not invoke a paid external reviewer without separate human approval.

## Context entry points

- `README.md`
- `package.json`
- `server.js`
- `.gitignore`
- `Dockerfile`
- `docker-compose.yml`

## Allowed change scope

- `AGENTS.md`
- `CLAUDE.md`
- `docs/agent/`
- `scripts/agent-protocol-check.sh`

## Constraints and approval boundaries

- Work only in the assigned branch/worktree.
- Preserve all existing product and state files byte-for-byte.
- Record live data, secret, port, container, n8n, and deployment boundaries.
- Reviewer calls and integration require explicit human authority.

## Dependencies

- Base commit `a12c76c761a393793fd8e8c074ee86bad6108f04`.
- CoWorkAi `bootstrap-agent-project` skill draft at commit `5e69294`.

## Acceptance criteria

- [x] Pilot uses an isolated branch/worktree from a clean known base.
- [x] Shared instructions and the Claude adapter are project-specific and concise.
- [x] Task, handoff, review, and checker contracts exist.
- [x] Diff contains protocol artifacts only.
- [x] Protocol, syntax, parser, and whitespace checks pass.
- [x] Remaining limitations and next action are recorded in a handoff.

## Verification

```text
./scripts/agent-protocol-check.sh
node --check server.js
node scripts/test-parse.js
git diff --check
git diff --name-only a12c76c761a393793fd8e8c074ee86bad6108f04
```

## Progress and decisions

- The bootstrap inspector classified the clean task worktree as `ready`.
- The inspector identified `data/` and `uploads/` as protected stateful paths.
- Scaffold installation completed only after a no-write dry run showed all
  destinations and no collisions.
- Protocol-only implementation commit: `885f48e`.
- Product files and protected state paths remain unchanged.
- Fable review attempt r1 read the skill and pilot but reached its budget before
  returning a verdict; it is recorded as `blocked`, not `pass`.
- Fable r2 started without tools because the CLI tool-pattern syntax was invalid;
  it returned no verdict and is also recorded as `blocked`.
