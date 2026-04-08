# Educoder Local OJ Agent Guide

## Current Product Center

This repository is no longer organized around lazy recovery materials.  
The product center is now the **full local task package**:

- `problem/`
- `code/current/`
- `tests/all/`
- `answers/unlocked/`
- `reports/latest_{local,remote,submit}.json`

`_educoder/` remains as internal/debug storage only.

---

## Non-Negotiable Working Rules

1. **No blind patches.** Start from failing tests or a concrete runtime reproduction.
2. **Local-first solve flow.**
   - read statement
   - edit `code/current/`
   - run local full tests
   - then submit remotely
3. **One official submit path.**
   - upload: `update_file.json`
   - judge: `game_build.json`
4. **Legacy-safe migration.**
   - old `workspace/`, `_educoder/tests/hidden/`, `_educoder/answer/` must remain usable
   - forward migration may copy into canonical paths
   - never delete legacy files until canonical files are confirmed written
5. **Docs stay in sync with product reality.**

---

## Canonical Docs

- `README.md`
- `agent.md`
- `docs/plans/2026-04-05-educoder-full-task-package-rebuild.md`
- `docs/reference/project-record.md`
- `docs/reference/api-inventory.md`

Older plan/design docs remain historical context, not current product truth.

---

## Architectural Boundaries

### Commands
- `src/commands/*`

### Sync / Package assembly
- `src/core/sync/*`
- `src/core/workspace/*`

### Local judge
- `src/core/judge/*`

### Remote judge / submit flow
- `src/core/remote/*`

### UI / state
- `src/core/ui/*`
- `src/views/*`
- `src/webview/*`

### Auth / runtime / transport
- `src/core/auth/*`
- `src/core/runtime/*`
- `src/core/api/*`
- `src/core/recon/*`

---

## Completion Standard

Work is not complete until all of the following are true:

- canonical task package layout works
- local judge defaults to `tests/all/`
- primary submit is `提交评测（本地 + 头哥）`
- local failure stops remote submission by default
- force-submit path exists
- legacy roots still open / judge / submit safely
- `npm test` passes
- `npm run typecheck` passes
- `npm run build` passes
- VSIX packages successfully
