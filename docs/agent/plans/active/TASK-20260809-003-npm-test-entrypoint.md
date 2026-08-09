---
id: TASK-20260809-003-npm-test-entrypoint
status: accepted
risk: low
owner: human
orchestrator: opus-5-claude-code
implementer: opus-implementer-claude-code
reviewer: hermes-agent-gpt-5.6-sol
branch: agent/TASK-20260809-003-npm-test-entrypoint
base_ref: main
blocked_on: none
created: 2026-08-09
updated: 2026-08-09
---

# Single npm entry point for the deterministic gates

## Goal

`npm test` runs every deterministic gate this repository already has, in one
command, and fails with a non-zero exit code as soon as one gate fails.

The gates that exist today are documented in `AGENTS.md` ("Project commands")
and `docs/agent/ORCHESTRATION.md` ("Deterministic gates"):

- `node --check server.js`
- `node scripts/test-parse.js`
- `bash scripts/orchestration-check.sh`
- `bash scripts/agent-protocol-check.sh`

`AGENTS.md` currently states that no general `npm test` script is declared. That
statement must become false and the file must say what is true afterwards.

## Non-goals

- Do not add a test framework, runner, or new dependency.
- Do not convert `scripts/test-parse.js` into an assertion-based test. Its lack
  of assertions is recorded as a known follow-up, not part of this task.
- Do not change gate scripts' own logic.
- Do not touch `server.js`, `public/`, `data/`, `uploads/`, Docker files, or
  `n8n-workflow.json`.
- Do not start the server. `npm start` creates `uploads/` and migrates local
  JSON data.

## Context entry points

- `package.json`: only a `start` script is declared.
- `AGENTS.md` "Project commands" section: lists the gates and the missing-test
  statement that must be corrected.
- `docs/agent/ORCHESTRATION.md` "Commands" section: the same gate list.
- `README.md`: setup and operating commands for a human reader.
- `scripts/orchestration-check.sh`, `scripts/agent-protocol-check.sh`: existing
  gates; both currently exit 0.

## Allowed change scope

- `package.json` (`scripts` block only; dependencies must not change).
- `AGENTS.md` (the "Project commands" section only).
- `README.md` (command documentation only, if it lists commands).
- The task, handoff, and review artifacts for this task id.

No other file may change. No external action, no network, no deployment.

## Constraints and approval boundaries

- Local, repository-only change. No SSH, no Docker, no deploy, no push, no
  merge to `main`.
- The composed command must short-circuit on the first failure and propagate a
  non-zero exit status.
- Keep it portable POSIX shell usable by npm; do not depend on tools absent from
  the repository.
- Adding or upgrading a dependency is material scope expansion and needs human
  approval first.

## Dependencies

None.

## Acceptance criteria

- [x] `npm test` runs all four gates and exits 0 on the current tree.
- [x] A deliberately failing gate makes `npm test` exit non-zero, demonstrated
      without leaving the repository modified.
- [x] `package.json` gains no dependency change.
- [x] `AGENTS.md` no longer claims that no `npm test` script exists and
      describes the actual behavior.
- [x] Diff touches only the allowed change scope.
- [x] `scripts/test-parse.js`'s missing assertions are recorded as a residual
      risk in the handoff.

## Verification

```text
npm test                      # expect exit 0
node --check server.js
bash scripts/orchestration-check.sh
bash scripts/agent-protocol-check.sh
git status --short            # expect a clean tree apart from intended files
git diff --stat main...HEAD   # expect only allowed-scope files
```

Failure propagation must be demonstrated by a temporary, reverted local edit or
an equivalent non-destructive method, and the method must be stated in the
handoff.

## Progress and decisions

- 2026-08-09: Card opened as the first end-to-end exercise of the protocol on
  real work. Worktree deliberately created under
  `Kitap Rafı/worktrees/` instead of `/private/tmp`, because temporary-directory
  worktrees from earlier tasks are the subject of a separate cleanup item.
- 2026-08-09: Implemented as a plain `&&` chain in `package.json` `scripts.test`;
  no runner and no dependency change. `AGENTS.md` "Project commands" corrected
  and `bash scripts/agent-protocol-check.sh` added to the documented gate list.
  `README.md` gained a "Doğrulama" section under its existing command docs.
  Failure propagation proved by a temporary, checksum-verified reverted edit to
  `scripts/orchestration-check.sh`; `npm test` exited 1 and gate 4 did not run.
  Evidence in `docs/agent/handoffs/TASK-20260809-003-npm-test-entrypoint.md`.
  Status moved to `review`; changes left uncommitted for the human owner.
  `docs/agent/ORCHESTRATION.md` still lists the gates without `npm test`; it is
  outside this card's allowed scope and is left for a follow-up.
- 2026-08-09: Independent cross-provider review by `hermes-agent-gpt-5.6-sol`
  (Hermes, `openai-codex`, file-read tools only) returned `verdict: pass`; see
  `docs/agent/reviews/TASK-20260809-003-npm-test-entrypoint-hermes-r1.md`. That
  review could not execute commands, so the orchestrator reran the integration
  gates independently: `npm test` exit 0; exit 127 with `node` removed from
  `PATH`; exit 1 with a deliberately malformed task card present, then exit 0
  after removing it (short-circuit confirmed without editing any gate script);
  `shasum -a 256 scripts/orchestration-check.sh` matched the recorded
  `238ca236f3beff60ec50a9b527c5aac440f81f0f869a14d3cc480195e0df1153`; no
  dependency line changed. Human owner accepted and authorized integration.
- 2026-08-09 follow-ups recorded, not opened as cards yet: assertion-based
  parser verification for `scripts/test-parse.js`, and advertising `npm test` in
  `docs/agent/ORCHESTRATION.md`.
