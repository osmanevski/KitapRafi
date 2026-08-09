# Handoff

## Identity

- Task: TASK-20260809-002-hermes-fable-orchestration
- From role/agent: implementer (Opus, opus-implementer subagent)
- To role/agent: orchestrator (Fable 5, Claude Code)
- Branch: agent/TASK-20260809-002-hermes-fable-orchestration
- Commit or diff: uncommitted working tree (base main@f45dc15)

## Result

The repository-local orchestration layer is in place except for the three
Claude Code agent definitions: writes to `.claude/` were refused by the session
permission system, so `.claude/agents/{fable-orchestrator,opus-implementer,
opus-reviewer}.md` do not exist and `scripts/orchestration-check.sh` currently
fails on exactly those three files. Everything else exists: the cross-harness
skill, the four wrappers, `docs/agent/ORCHESTRATION.md`, and the additive
`AGENTS.md`/`PROTOCOL.md` pointers. No product file changed, nothing was
committed, and the Hermes binary was never executed.

## Changed artifacts

- `docs/agent/plans/active/TASK-20260809-002-hermes-fable-orchestration.md`:
  new task card; scope, boundaries, and verification for this work.
- `.agents/skills/kitaprafi-orchestration/SKILL.md`: portable operating rules
  for any harness (read-first, task-card-before-edit, isolation, verification,
  boundaries, evidence). Scaffolded with the skill-creator `init_skill.py`,
  then rewritten; all boilerplate removed.
- `.agents/skills/kitaprafi-orchestration/agents/openai.yaml`: interface
  metadata produced by the scaffold (identical to `generate_openai_yaml.py`
  defaults).
- `scripts/fable-orchestrate.sh`: launches Claude Code with the
  `fable-orchestrator` agent; refuses to run without `--authorize-paid-models`;
  passes `--max-budget-usd` (default 5); prints the exact command before exec.
- `scripts/hermes-review.sh`: read-only cross-provider review worker. Prompt is
  read from a file and delivered on stdin; probes `hermes --help` for one-shot,
  profile, provider, model, and toolset-disabling constructs and fails closed;
  requires the `kitaprafi` profile and `openai-codex` auth; disables terminal,
  delegation, memory-write, skill-write toolsets; exports
  `HERMES_WRITE_SAFE_ROOT` to a `mktemp -d` sentinel outside the repository;
  writes transcript and usage JSON to temporary paths; no fallback provider.
- `scripts/hermes-profile-setup.sh`: dry-run by default; prints the intended
  profile plan (single `openai-codex` provider for primary and auxiliary,
  no fallbacks, `skills.external_dirs` including `.agents/skills`, smart
  approvals, approval-gated memory and skill writes) and the interactive auth
  command the human must run. `--apply` probes `hermes --help` and still
  refuses to write configuration it cannot verify.
- `scripts/orchestration-check.sh`: deterministic structure gate for agent
  definitions, skill files, wrapper presence/executability/syntax, provider and
  safe-root invariants, the paid-model gate, and `ORCHESTRATION.md`.
- `docs/agent/ORCHESTRATION.md`: architecture, commands, context envelopes,
  cost accounting, failure modes, glossary.
- `AGENTS.md`: three source-map lines and one project-command line, additive.
- `docs/agent/PROTOCOL.md`: one pointer line to `ORCHESTRATION.md`.

## Verification evidence

| Command or check | Result | Notes |
|---|---|---|
| `bash -n scripts/fable-orchestrate.sh` | pass | exit 0, no output |
| `bash -n scripts/hermes-review.sh` | pass | exit 0, no output |
| `bash -n scripts/orchestration-check.sh` | pass | exit 0, no output |
| `bash -n scripts/hermes-profile-setup.sh` | pass | exit 0, no output |
| `bash scripts/orchestration-check.sh` | fail | exit 1; only `FAIL: missing agent definition .claude/agents/{fable-orchestrator,opus-implementer,opus-reviewer}.md` |
| `bash scripts/agent-protocol-check.sh` | pass | exit 0, `PASS: agent protocol structure and task semantics are valid` |
| `node --check server.js` | pass | exit 0, no output |
| `node scripts/test-parse.js` | pass | exit 0, printed the two parsed sample books |
| skill `quick_validate.py` | not-run | `ModuleNotFoundError: No module named 'yaml'`; `python3 -m pip install --user pyyaml` was refused by the session sandbox, and no alternative interpreter could be probed. Frontmatter was inspected manually: only `name` and `description` keys, hyphen-case name, no angle brackets, well under the length limits. |
| `hermes` execution | not-run | Out of scope by task constraint; the binary is also not executable from this sandbox. |

## Deviations

- `.claude/agents/*.md` were not created: three `Write` attempts were refused
  by the permission system ("Claude requested permissions to write to ...,
  but you haven't granted it yet"). Not authorized, not worked around; using
  `Bash` heredocs to bypass a denied permission would have been circumvention.
- `generate_openai_yaml.py` could not be re-run (sandbox refused the command),
  so `agents/openai.yaml` is the scaffold output from `init_skill.py`, which
  uses the same generator logic and produced a valid 37-character
  `short_description`.
- `scripts/hermes-profile-setup.sh --apply` intentionally never writes
  configuration even when `hermes --help` mentions `config`/`profile`/`auth`,
  because the exact profile-creation argument spellings are unverified and a
  wrong guess could create a profile with a paid fallback provider.
- A throwaway validation script was created and deleted inside the worktree;
  one stray copy remains at `/tmp/kitaprafi-skill-validate.py` (outside the
  repository) because the sandbox refused to delete it.

## Remaining risks and assumptions

- `scripts/orchestration-check.sh` will keep failing until the three
  `.claude/agents/*.md` files exist. The check is correct; the artifacts are
  missing.
- Hermes flag spellings are assumed only through runtime probing. The candidate
  lists in `hermes-review.sh` (`-z`, `--profile`, `--provider`, `--model`,
  `--disable-toolset*`) and the profile/auth listing subcommands were never
  executed and may need adjustment on first real run; the script fails closed
  rather than guessing.
- `HERMES_WRITE_SAFE_ROOT` enforcement is assumed to be honored by Hermes; the
  disabled toolsets are the primary read-only control.
- The Hermes `kitaprafi` profile and its `openai-codex` OAuth session do not
  exist yet; until the human creates them, review falls back to `opus-reviewer`.

## Next action

Orchestrator: obtain permission to write `.claude/agents/` (or create the three
definitions yourself from the content described in the task card), rerun
`bash scripts/orchestration-check.sh` until it prints PASS, then route the diff
to an independent reviewer and own the commit.
