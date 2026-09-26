---
id: TASK-20260926-001-terminal-catalog
status: accepted
risk: medium
owner: human
orchestrator: root
implementer: root
reviewer: independent-session
branch: task/20260926-terminal-catalog
base_ref: eb04ab0
blocked_on: none
created: 2026-09-26
updated: 2026-09-26
---
# Terminal catalog source ownership

## Goal
Own the terminal list catalog in this project at public/vt, serving the already authorized main /kitaprafi/ route. Keep the classic list and exhibition available.

## Non-goals
No exhibition redesign, API, credentials, data/, uploads/, or container changes.

## Context entry points
public/books.json, public/kitaplar.html, public/vt/, README.md.

## Allowed change scope
New public/vt files, deterministic catalog test, documentation. User explicitly requested these project paths and live deployment earlier in the session. Main-site Caddy will serve /opt/kitaprafi/public/vt directly; existing proxy routes stay intact.

## Constraints and approval boundaries
Preserve user work and production data. Worktree isolation and independent read-only review before integration.

## Dependencies
Root site provides wallpaper/fonts. Catalog reads /kitaprafi/books.json, never the exhibition API.

## Acceptance criteria
- [x] Catalog source is owned here and existing catalog behavior preserved.
- [x] Tests and independent review pass.
- [ ] Live routes serve these project files; classic and data routes remain available.

## Verification
npm test
node scripts/test-terminal-catalog.mjs
node --check public/vt/app.js

## Progress and decisions
- Port the already tested terminal list from Osmanevski.com; no live data copies.
