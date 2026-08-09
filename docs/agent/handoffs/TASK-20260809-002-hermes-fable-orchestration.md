# Handoff

## Identity

- Task: TASK-20260809-002-hermes-fable-orchestration
- From role/agent: orchestrator (Fable 5) with Opus implementer; Codex hardening
- To role/agent: independent Hermes/Codex reviewer
- Branch: agent/TASK-20260809-002-hermes-fable-orchestration
- Commit or diff: baseline `main@f45dc15..HEAD`; Hermes r1 reviewed the exact
  immutable ref `6ccd0c3` and required remediation. The immutable r2 target is
  recorded in its review prompt and tracked review artifact.

## Result

The repository-local Fable/Opus/Hermes orchestration layer is implemented.
Fable 5 is the Claude Code orchestrator, Opus is the editing/review subagent,
and Hermes is an isolated read-only cross-provider reviewer backed by
`openai-codex` OAuth. The dedicated Hermes `kitaprafi` profile was created and
authenticated with user authorization; it has no Anthropic, OpenRouter, or
other paid fallback. No product file changed.

## Changed artifacts

- `.claude/agents/fable-orchestrator.md`: Fable orchestration contract with
  `Agent` delegation and explicit authority boundaries.
- `.claude/agents/opus-implementer.md`: edit-capable Opus implementation role.
- `.claude/agents/opus-reviewer.md`: read-only Opus review role.
- `.agents/skills/kitaprafi-orchestration/`: portable repository workflow and
  Codex interface metadata.
- `scripts/fable-orchestrate.sh`: explicit paid-model acknowledgment, bounded
  prompt, Claude subscription-auth checks, `--print`, and budget ceiling.
- `scripts/hermes-profile-setup.sh`: dry-run by default; `--apply` creates or
  repairs only the isolated `kitaprafi` profile, pins
  `openai-codex`/`gpt-5.6-sol`, disables fallbacks, and links the repository
  skill directory.
- `scripts/hermes-review.sh`: one-shot read-only review using only the `file`
  toolset, a safe-root sentinel outside the repository, and
  transcript/usage files outside the repository.
- `scripts/orchestration-check.sh`: deterministic checks for agent placement,
  frontmatter, safe providers, wrapper syntax, and safety gates.
- `docs/agent/ORCHESTRATION.md`: roles, flows, commands, context envelopes,
  cost interpretation, failure modes, and glossary.
- `AGENTS.md`, `docs/agent/PROTOCOL.md`, task card, and this handoff: additive
  navigation and governance records.

## Verification evidence

| Command or check | Result | Notes |
|---|---|---|
| `bash -n scripts/{fable-orchestrate,hermes-profile-setup,hermes-review,orchestration-check}.sh` | pass | all four scripts parse |
| `bash scripts/orchestration-check.sh` | pass | orchestration structure and safety invariants |
| `bash scripts/agent-protocol-check.sh` | pass | protocol/task semantics |
| `node --check server.js` | pass | no syntax regression |
| `node scripts/test-parse.js` | pass | two sample books parsed |
| `quick_validate.py .agents/skills/kitaprafi-orchestration` | pass | `Skill is valid!` |
| `scripts/hermes-profile-setup.sh --apply` | pass | isolated profile created and pinned |
| `hermes --profile kitaprafi auth add openai-codex --type oauth` | pass | device OAuth completed |
| `git diff --check` | pass | no whitespace errors |

## Deviations

- The Opus implementer initially staged Claude agent definitions under
  `docs/agent/claude-agents/` after its write permission to `.claude/` was
  denied. Codex moved the definitions to the required `.claude/agents/`
  location and deleted the staging copies.
- The initial wrappers contained assumptions that did not match the installed
  CLIs (`Task`, missing Claude `--print`, nonexistent Hermes
  `--disable-toolset`, and stdin use with `-z`). These were corrected against
  Claude Code 2.1.226 and Hermes Agent 0.20.0 before review.
- Fable's implementation run reported USD-equivalent usage metadata. This is a
  budget/accounting estimate from Claude Code, not evidence of a separate API
  charge; the wrapper rejects API-key authentication.
- Hermes/Codex r1 returned `blocked`: fallback verification, human authority,
  usage-output path safety, and this handoff's stale ref required remediation.

## Remaining risks and assumptions

- Hermes review r1 is blocked; integration must wait for a passing r2 verdict.
- `skills.external_dirs.0` currently resolves from the task worktree. After
  fast-forward integration, rerun `scripts/hermes-profile-setup.sh --apply`
  from the main checkout to pin the stable repository path.
- The OAuth credential and profile are user-level state, intentionally outside
  Git. Repository scripts validate presence and fail closed when unavailable.

## Next action

Commit the r1 remediation, resolve the exact immutable commit in the r2 prompt,
record the reviewer artifact, and integrate by fast-forward only if r2 passes.
