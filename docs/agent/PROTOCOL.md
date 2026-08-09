# Project Agent Protocol

## Authority

The human owner defines outcomes, approves risky or external actions, resolves
product ambiguity, and accepts delivery. Repository state outranks session memory.

## Roles

- Orchestrator: scopes, routes, tracks, and summarizes; normally read-mostly.
- Implementer: owns one bounded task and one writable branch/worktree.
- Reviewer: independently inspects the task, diff/commit, rules, and evidence.
- Integration gate: runs deterministic checks and controls merge readiness.

## Lifecycle

```text
triage -> ready -> in_progress -> review -> accepted -> completed
                         |           |
                         +-> blocked <-+
```

Task cards live in `docs/agent/plans/active/` and move to
`docs/agent/plans/completed/` after integration. A blocked task names its
dependency in `blocked_on`.

## Isolation

1. Start from a known commit.
2. Give each writer a unique non-integration branch and worktree.
3. Record the branch and base in the task.
4. Treat ports, databases, containers, caches, credentials, and external services
   as shared until the project explicitly isolates them.
5. Preserve work before handoff and merge only after review and gates.

## Context envelopes

- Orchestrator: goal, architecture map, task graph, decisions, concise handoffs.
- Implementer: one task, relevant rules/files, boundaries, required checks.
- Reviewer: original task, diff/commit, relevant rules, verification evidence.

Do not pass complete worker transcripts or unrestricted logs by default. Link to
repository evidence and load detail progressively.

## Evidence

Use the templates in `docs/agent/templates/`.

- A task in `review` requires `docs/agent/handoffs/<task-id>.md`.
- `accepted` and `completed` require an independent review artifact with
  structured `verdict: pass`.
- A blocked or interrupted review is evidence of an attempt, not acceptance.
- Rerun deterministic project and protocol gates at integration time.

## Routing

Route simple work directly. Add an independent reviewer as risk or ambiguity
increases. Use expensive models only where measured judgment justifies their cost
and only with explicit authority. Optimize successful delivery, not token count
alone.
