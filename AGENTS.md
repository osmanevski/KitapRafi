# Agent Instructions

## Purpose

Use repository artifacts as the shared source of truth for human and coding-agent
work. Keep this file short; project details belong in authoritative source files.

## Source map

- `README.md`: product purpose, setup, and operating constraints.
- `server.js`: Express API, authentication, file upload, persistence, and server
  startup behavior.
- `public/`: public site and admin panel.
- `OTOMASYON.md`, `n8n-workflow.json`: external book-ingestion automation.
- `Dockerfile`, `docker-compose.yml`: container and persistent-volume boundary.
- `docs/agent/PROTOCOL.md`: task, context, handoff, and review workflow.
- `docs/agent/plans/active/`: current task contracts.
- `docs/agent/plans/completed/`: completed task history.
- `docs/agent/handoffs/`: implementation evidence.
- `docs/agent/reviews/`: independent review evidence.

## Required rules

1. Inspect Git status and current instructions before material changes.
2. Keep `main`/`master` as integration branches; writers use isolated branches
   and worktrees.
3. Create or identify a bounded task card before changing product files.
4. Preserve existing user work and never overwrite unrelated changes.
5. Discover commands from repository evidence; do not invent tests or deploy
   procedures.
6. Run verification proportional to the changed files and record actual results.
7. Keep secrets, credentials, private transcripts, and live data out of tracked
   agent artifacts.
8. Require explicit human authority for destructive actions, external writes,
   paid model calls, deployment, and material scope expansion.
9. Use independent review for non-trivial or risky work.
10. Move a task to completed only after review, acceptance, and integration gates.

## Project commands

- Install dependencies: `npm install`.
- Start locally: `ADMIN_KEY=<local-secret> npm start`. Starting the server may
  create `uploads/` and migrate local JSON data, so do not use it for a
  protocol-only task.
- Syntax check: `node --check server.js`.
- Parser smoke test: `node scripts/test-parse.js`.
- No general `npm test` script is currently declared in `package.json`.

## Protected project boundaries

- `data/` contains canonical book and author JSON. Treat it as stateful data;
  modify it only when the task explicitly requires a data change.
- `uploads/` contains persistent cover files and is a Docker volume. Do not copy,
  delete, normalize, or deploy it during unrelated work.
- `.env` and `.env.*` contain secrets such as `ADMIN_KEY` and AI provider keys;
  never read them into agent artifacts or commit them.
- `n8n-workflow.json` represents an external automation boundary. Changing the
  file does not authorize writing to the live n8n instance.
- Deployment, PM2, Docker operations, SSH, and live service restarts require
  explicit human authorization. Code changes never imply deployment authority.
- Port `3000`, persistent data, containers, and credentials are shared resources
  unless a task defines isolated replacements for its worktree.
