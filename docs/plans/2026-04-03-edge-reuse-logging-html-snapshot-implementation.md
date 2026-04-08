# Edge Reuse + Logging + HTML Snapshot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an opt-in “daily Edge reuse” auth mode (DevTools port), an OutputChannel with layered diagnostics, and a `collection.page.html` snapshot written during `Sync Current Collection`.

**Architecture:** Keep core logic testable via dependency injection. Add a small logging interface (no vscode dependency) and wire it to a VS Code OutputChannel in `extension.ts`. Add a persistent debug-port store in `globalState` and prefer it in session resolution.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node child_process/fs/path.

---

### Task 1: Add a tiny logging interface + error-chain formatter (TDD)

**Files:**
- Create: `src/core/logging/logger.ts`
- Create: `src/core/logging/errorFormat.ts`
- Create: `tests/unit/errorFormat.test.ts`

**Step 1: Write the failing test**

`tests/unit/errorFormat.test.ts`:
- formats a simple Error
- formats nested causes
- redacts known sensitive keys (at least: `_educoder_session`, `autologin_trustie`, `Cookie`, `Pc-Authorization`)

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/errorFormat.test.ts`
Expected: FAIL (module missing)

**Step 3: Write minimal implementation**

- `formatErrorChain(err): string[]` returning lines
- `redact(text): string`

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/errorFormat.test.ts`
Expected: PASS

---

### Task 2: Wire VS Code OutputChannel + add “Show Logs” command

**Files:**
- Modify: `package.json` (contributes.commands + activationEvents)
- Modify: `src/extension.ts`
- Create: `src/commands/showLogs.ts`
- Test: `tests/smoke/commands.smoke.test.ts` (ensure command exists)

**Step 1: Write/adjust failing test**

Assert `educoderLocalOj.showLogs` is registered after activate.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/smoke/commands.smoke.test.ts`
Expected: FAIL (command not found)

**Step 3: Implement minimal command + output channel singleton**

- create output channel once
- command shows it

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/smoke/commands.smoke.test.ts`
Expected: PASS

---

### Task 3: Add Edge debug-port store + “Enable Edge Reuse (Debug Mode)” command

**Files:**
- Create: `src/core/auth/edgeDebugPortStore.ts`
- Create: `src/commands/enableEdgeReuse.ts`
- Modify: `package.json` (command + activation)
- Modify: `src/extension.ts` (command wiring)
- Test: `tests/unit/edgeDebugPortStore.test.ts`

**Step 1: Write failing tests**

- store/get/clear port in a fake globalState
- validation: only positive integers accepted

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/edgeDebugPortStore.test.ts`
Expected: FAIL

**Step 3: Minimal implementation**

- `getEdgeDebugPort(context)`
- `setEdgeDebugPort(context, port)`
- `clearEdgeDebugPort(context)`

Command behavior:
- pick a free port
- spawn Edge with `--remote-debugging-port=<port>` and **no** `--user-data-dir`
- wait for `http://127.0.0.1:<port>/json/list`
- persist port
- show a message guiding user to keep the window and login if needed

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/edgeDebugPortStore.test.ts`
Expected: PASS

---

### Task 4: Prefer stored debug port in session resolution and log the path taken

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/core/auth/sessionManager.ts` (optional: add logger hooks)
- Modify: `src/core/auth/edgeReuse.ts` (optional: add logger hooks)
- Test: `tests/unit/sessionManager.test.ts` (new cases)

**Step 1: Write failing tests**

- when debug port exists and returns cookies → session resolves without login fallback
- when debug port exists but returns undefined → shows guidance error (no temp profile) if “edge reuse enabled”

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/sessionManager.test.ts`
Expected: FAIL

**Step 3: Implement minimal changes**

- in `createDefaultEducoderClient()` provide `loadFromEdge` override that tries stored port first
- if edge-reuse is enabled (port set) and no session can be obtained → throw an actionable error

**Step 4: Re-run tests**

Run: `npm test -- tests/unit/sessionManager.test.ts`
Expected: PASS

---

### Task 5: Add collection HTML snapshot writing (TDD)

**Files:**
- Modify: `src/commands/syncCurrentCollection.ts`
- Create: `tests/unit/collectionPageSnapshot.test.ts`

**Step 1: Write failing test**

- provide a `fetchCollectionPageHtml` stub returning `{ url, html, contentType }`
- run `syncCurrentCollection()`
- assert `${collectionRoot}/collection.page.html` exists and contains html
- assert `${collectionRoot}/collection.page.meta.json` contains url + contentType

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/collectionPageSnapshot.test.ts`
Expected: FAIL

**Step 3: Minimal implementation**

- add optional deps to `syncCurrentCollection` for page fetch + file writes
- ensure failures don’t break index sync

**Step 4: Re-run test**

Run: `npm test -- tests/unit/collectionPageSnapshot.test.ts`
Expected: PASS

---

### Task 6: Integrate page fetcher + logging in the real extension graph

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/core/api/fetchTransport.ts` (optional: log status/duration)

**Steps:**
- wire `fetchCollectionPageHtml` using a client with `baseUrl: https://www.educoder.net`
- log start/end + failures to OutputChannel

Verify:
- `npm test`
- `npm run typecheck`

---

## Verification

Run:
- `npm test`
- `npm run typecheck`
- `npm run build`

Manual:
- run “Enable Edge Reuse (Debug Mode)” once, login in that window
- run “Sync Current Collection” and confirm `collection.page.html` appears
- on failure, confirm OutputChannel contains phase logs + error chain
