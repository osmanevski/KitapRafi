---
task: TASK-20260809-002-hermes-fable-orchestration
reviewer: Hermes / openai-codex / gpt-5.6-sol
round: 1
verdict: blocked
reviewed_ref: 6ccd0c3
created: 2026-08-09
---

# Independent Review

## Scope

- Reviewed task and commit/diff: `f45dc15..6ccd0c3`.
- Verification inspected: every changed orchestration/governance path plus the
  repository review template and installed Hermes v0.20.0 toolset, environment,
  and security references.
- Execution boundary: Hermes received only the `file` toolset; transcript and
  native usage JSON remained temporary and outside Git.

## Verdict

Blocked. Fable/Opus role separation, Claude print-mode budget enforcement,
minimal Hermes tool exposure, context envelopes, and product-file scope all
passed inspection. Four findings required remediation before integration.

## Findings

### [high] Fallback validation did not fail closed

- Evidence at reviewed ref: `scripts/hermes-review.sh:61-64` suppressed listing
  failures and rejected selected provider names instead of proving an empty
  chain; this contradicted `docs/agent/ORCHESTRATION.md:74-79`.
- Impact: an unrecognized listing failure or another provider could evade the
  no-fallback contract.
- Required change: require successful listing and the Hermes empty-chain status.

### [medium] Human integration authority was contradictory

- Evidence at reviewed ref: task lines 34-35 assigned local integration to the
  orchestrator while lines 69-73 prohibited it, conflicting with
  `.claude/agents/fable-orchestrator.md:26-27`.
- Impact: commit, merge, and acceptance authority was ambiguous.
- Required change: keep authority with the human; Fable may coordinate or
  recommend only.

### [medium] Usage output could traverse a symbolic link

- Evidence at reviewed ref: `scripts/hermes-review.sh:69-82` resolved only the
  parent before passing the final path to Hermes at lines 103-112.
- Impact: an outside path could be a link to a repository file.
- Required change: reject existing paths/links and securely reserve the exact
  output before model execution.

### [medium] Handoff identified a stale review target

- Evidence at reviewed ref: handoff lines 8-10 named `de9d0df` plus an
  unspecified diff; lines 83-87 still described committing that diff.
- Impact: evidence was not tied to the immutable `6ccd0c3` review target.
- Required change: record immutable review refs and associate follow-up
  evidence with the exact remediation target.

## Acceptance-criteria check

- [ ] Goal is satisfied; r1 blockers remain.
- [x] Scope and non-goals were respected.
- [x] Verification evidence is credible for the reviewed ref.
- [x] Remaining risks are explicit.

## Residual risk

- The Opus reviewer retains Bash and relies partly on instructions not to write.
- Hermes `file` includes mutation tools; write safety depends on the runtime
  honoring `HERMES_WRITE_SAFE_ROOT`.
- OAuth and applied-profile state remain intentionally outside Git and require
  runtime validation.

## Remediation disposition

Addressed in `8d3590f`; an independent r2 verdict is required before acceptance.
