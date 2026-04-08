# Educoder Local OJ Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the project around a shared runtime, real auth validation, canonical docs, and integrated recon instrumentation so the extension becomes maintainable and reliable.

**Architecture:** Keep existing feature modules that already encode product behavior, but move all dependency construction into a shared runtime and add a first-class observability layer. Replace shape-only auth checks with real session validation and make recon artifacts a built-in part of the product graph instead of ad-hoc notes.

**Tech Stack:** TypeScript, VS Code Extension API, Vitest, Node fetch/fs/path, existing Educoder API clients, request-trace inventory.

---

### Task 1: Rebuild the canonical docs surface

**Files:**
- Create: `agent.md`
- Create: `docs/plans/2026-04-04-educoder-rebuild-design.md`
- Create: `docs/plans/2026-04-04-educoder-rebuild.md`
- Create: `docs/reference/project-record.md`
- Create: `docs/reference/api-inventory.md`

**Step 1: Write the failing test**

Documentation task — no code test.

**Step 2: Run test to verify it fails**

Not applicable.

**Step 3: Write minimal implementation**

Create the canonical docs that define:
- rebuild mission
- runtime architecture
- recon process
- interface inventory
- target processes and artifacts

**Step 4: Run test to verify it passes**

Manual verification:
- files exist
- content reflects current architecture
- future work has a single obvious home

**Step 5: Commit**

```bash
git add agent.md docs/plans/2026-04-04-educoder-rebuild-design.md docs/plans/2026-04-04-educoder-rebuild.md docs/reference/project-record.md docs/reference/api-inventory.md
git commit -m "docs: rebuild canonical agent and project records"
```

---

### Task 2: Extract shared runtime and replace shape-only auth checks

**Files:**
- Create: `src/core/runtime/extensionRuntime.ts`
- Create: `src/core/auth/sessionValidation.ts`
- Modify: `src/extension.ts`
- Test: `tests/unit/sessionValidation.test.ts`
- Test: `tests/unit/extensionRuntime.test.ts`

**Step 1: Write the failing test**

Done:
- runtime must validate cached sessions through a real homepage probe
- runtime must expose a shared client/session resolver

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/sessionValidation.test.ts tests/unit/extensionRuntime.test.ts
```

Expected: FAIL before implementation.

**Step 3: Write minimal implementation**

Implement:
- `createHomepageSessionValidator()`
- `createExtensionRuntime()`
- shared runtime activation in `extension.ts`

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/unit/sessionValidation.test.ts tests/unit/extensionRuntime.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/runtime/extensionRuntime.ts src/core/auth/sessionValidation.ts src/extension.ts tests/unit/sessionValidation.test.ts tests/unit/extensionRuntime.test.ts
git commit -m "refactor: extract shared runtime and real session validation"
```

---

### Task 3: Add transport tracing and API inventory

**Files:**
- Modify: `src/core/api/fetchTransport.ts`
- Create: `src/core/recon/apiInventory.ts`
- Test: `tests/unit/fetchTransport.test.ts`
- Test: `tests/unit/apiInventory.test.ts`

**Step 1: Write the failing test**

Done:
- transport emits request trace events
- inventory deduplicates endpoints and preserves ordered traces

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/unit/fetchTransport.test.ts tests/unit/apiInventory.test.ts
```

Expected: FAIL before implementation.

**Step 3: Write minimal implementation**

Implement:
- `TransportTraceEvent`
- trace emission in `createFetchTransport()`
- endpoint aggregation in `createApiInventory()`

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/unit/fetchTransport.test.ts tests/unit/apiInventory.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/core/api/fetchTransport.ts src/core/recon/apiInventory.ts tests/unit/fetchTransport.test.ts tests/unit/apiInventory.test.ts
git commit -m "feat: add transport tracing and api inventory"
```

---

### Task 4: Clean command/runtime boundary

**Files:**
- Modify: `src/extension.ts`
- Modify: `tests/smoke/realServiceGraph.smoke.test.ts`
- Modify: `tests/smoke/commands.smoke.test.ts`

**Step 1: Write the failing test**

Add or keep smoke coverage that proves:
- shared runtime is active after activation
- command wiring still works through the real graph

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/smoke/realServiceGraph.smoke.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: FAIL if command/runtime refactor breaks activation.

**Step 3: Write minimal implementation**

Finish shrinking `extension.ts` so it becomes:
- activation
- command routing
- runtime access

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/smoke/realServiceGraph.smoke.test.ts tests/smoke/commands.smoke.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/extension.ts tests/smoke/realServiceGraph.smoke.test.ts tests/smoke/commands.smoke.test.ts
git commit -m "refactor: simplify command wiring around shared runtime"
```

---

### Task 5: Push auth flow to production quality

**Files:**
- Modify: `src/core/auth/loginFlow.ts`
- Modify: `src/core/auth/educoderSessionResolver.ts`
- Modify: `src/commands/enableEdgeReuse.ts`
- Test: `tests/unit/loginFlow.test.ts`
- Test: `tests/unit/educoderSessionResolver.test.ts`
- Test: `tests/unit/sessionManager.test.ts`

**Step 1: Write the failing test**

Add or refine tests for:
- persisted Edge port path
- no temp-profile fallback when Edge reuse is enabled
- clearer failure behavior when homepage validation fails

**Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/loginFlow.test.ts tests/unit/educoderSessionResolver.test.ts tests/unit/sessionManager.test.ts
```

**Step 3: Write minimal implementation**

Make auth UX match real usage:
- Edge reuse first
- temp profile last
- bad sessions never silently cached as “good enough”

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/loginFlow.test.ts tests/unit/educoderSessionResolver.test.ts tests/unit/sessionManager.test.ts
```

**Step 5: Commit**

```bash
git add src/core/auth/loginFlow.ts src/core/auth/educoderSessionResolver.ts src/commands/enableEdgeReuse.ts tests/unit/loginFlow.test.ts tests/unit/educoderSessionResolver.test.ts tests/unit/sessionManager.test.ts
git commit -m "fix: harden edge-first auth flow"
```

---

### Task 6: Verify and ship coherent artifacts

**Files:**
- Modify: `dist/**`
- Modify: `educoder-local-oj-extension-0.0.1.vsix`

**Step 1: Write the failing test**

Not applicable — verification/build task.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: identify any regression before packaging.

**Step 3: Write minimal implementation**

Fix any final breakage, then rebuild generated artifacts.

**Step 4: Run test to verify it passes**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all green.

**Step 5: Commit**

```bash
git add dist educoder-local-oj-extension-0.0.1.vsix
git commit -m "build: refresh distributable artifacts after rebuild"
```

---

Plan complete and saved to `docs/plans/2026-04-04-educoder-rebuild.md`.

按用户明确要求，后续默认直接在当前会话按此计划继续执行，不再等待额外确认。
