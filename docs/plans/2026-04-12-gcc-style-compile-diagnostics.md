# GCC-Style Compile Diagnostics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make local compile failures display the first real GCC-style `file:line:column: error: ...` block instead of a vague function-context line.

**Architecture:** Add one focused parser that extracts the first meaningful compiler diagnostic block from raw `g++` stderr. Reuse that parser in both the task workbench summary and the explicit local-judge notification path so the user sees the same headguy-style error shape everywhere.

**Tech Stack:** TypeScript, Vitest, existing local judge/state model pipeline.

---

### Task 1: Add diagnostic parser tests

**Files:**
- Create: `tests/unit/compileDiagnostics.test.ts`

**Step 1: Write the failing test**

Add tests that prove:
- the parser skips `In function ...` wrapper lines
- the parser returns the first real `path:line:column: error: ...` line
- the parser includes the following source line and caret line
- the parser falls back cleanly when stderr has no GCC-style diagnostic

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/compileDiagnostics.test.ts`
Expected: FAIL because the parser module does not exist yet.

### Task 2: Add state-model and command regression tests

**Files:**
- Modify: `tests/unit/stateModel.test.ts`
- Modify: `tests/unit/runLocalJudgeCommand.test.ts`

**Step 1: Write the failing tests**

Add expectations that:
- local judge summary detail prefers `add/polynomial.cpp:15:11: error: ...`
- detail keeps the following code line and caret line
- the explicit local-judge toast also uses the parsed GCC-style headline instead of `In member function ...`

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/compileDiagnostics.test.ts tests/unit/stateModel.test.ts tests/unit/runLocalJudgeCommand.test.ts`
Expected: FAIL with the current first-non-empty-line behavior.

### Task 3: Implement the parser

**Files:**
- Create: `src/core/judge/compileDiagnostics.ts`

**Step 1: Write minimal implementation**

Implement:
- `extractFirstCompileDiagnosticBlock(stderr: string): string | undefined`
- helper patterns for GCC/Clang style diagnostics
- fallback behavior that still returns `undefined` when no structured block exists

**Step 2: Run tests**

Run: `npx vitest run tests/unit/compileDiagnostics.test.ts`
Expected: PASS

### Task 4: Wire parsed diagnostics into UI summary and notifications

**Files:**
- Modify: `src/core/ui/stateModel.ts`
- Modify: `src/commands/runLocalJudge.ts`

**Step 1: Replace first-line-only compile error extraction**

Use the new parser first, then fall back to the existing raw first line only if no structured diagnostic is found.

**Step 2: Run focused tests**

Run: `npx vitest run tests/unit/compileDiagnostics.test.ts tests/unit/stateModel.test.ts tests/unit/runLocalJudgeCommand.test.ts`
Expected: PASS

### Task 5: Verify the whole repository

**Files:**
- Modify if needed: `package.json`
- Modify if needed: `package-lock.json`
- Modify if needed: `CHANGELOG.md`

**Step 1: Decide release bookkeeping**

Because this is user-visible behavior, bump patch version and add a changelog entry if code changes ship.

**Step 2: Run repository verification**

Run:
- `npm run verify`
- `npm run release:check`

Expected:
- `verify` passes
- `release:check` passes on a clean tree

### Task 6: Commit

**Files:**
- Commit all code, tests, and release metadata together

**Step 1: Commit**

```bash
git add docs/plans/2026-04-12-gcc-style-compile-diagnostics.md src tests package.json package-lock.json CHANGELOG.md
git commit -m "fix: show gcc-style local compile diagnostics"
```
