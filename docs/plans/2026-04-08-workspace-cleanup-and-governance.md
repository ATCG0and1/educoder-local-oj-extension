# Workspace Cleanup And Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** promote the recovered repository into one clean canonical workspace, remove obsolete residue, and codify version-control/release rules.

**Architecture:** keep the old stable directory path as the canonical local workspace, turn it into a standalone GitHub-backed repository, and document the operational rules in repo files instead of relying on memory.

**Tech Stack:** Git, PowerShell, Node.js, npm, Markdown

---

### Task 1: Promote a clean standalone repo to the old stable path

**Files:**
- Modify: local filesystem layout only
- Test: `git status --short --branch`

**Step 1: Clone the public repository into a temporary clean directory**

Run: `git clone https://github.com/zyylovelyyso/educoder-local-oj-extension.git educoder-local-oj-extension-clean`

**Step 2: Remove linked-worktree residue from the obsolete recovery layout**

Run: `git -C educoder-local-oj-extension worktree remove educoder-local-oj-extension-recovered --force`

**Step 3: Refill the stable old path with the clean standalone clone**

Run: use PowerShell copy/mirror so `educoder-local-oj-extension` becomes the canonical workspace again.

**Step 4: Verify the promoted workspace**

Run: `git -C educoder-local-oj-extension status --short --branch`
Expected: clean branch on `main`

### Task 2: Remove public-facing wording that belongs only to internal engineering notes

**Files:**
- Modify: `README.md`

**Step 1: Remove the old-layout compatibility bullet from README**

The repository README should describe user-facing behavior, not internal migration policy.

### Task 3: Codify repo governance

**Files:**
- Create: `AGENTS.md`
- Create: `CHANGELOG.md`
- Create: `.gitattributes`
- Create: `scripts/release-check.mjs`
- Modify: `.gitignore`
- Modify: `.vscodeignore`
- Modify: `package.json`

**Step 1: Add one canonical agent instruction file**

Record project status, canonical paths, release links, compatibility rules, and verification/release gates.

**Step 2: Add strict release-state validation**

Implement `scripts/release-check.mjs` and wire npm scripts so versioning and clean-tree checks are repeatable.

**Step 3: Keep packaged VSIX clean**

Exclude AGENTS/changelog/scripts/internal metadata from the shipped VSIX.

### Task 4: Verify and publish housekeeping commit

**Files:**
- Test: repository root verification commands

**Step 1: Run verification**

Run:

```bash
npm install
npm run verify
npm run release:check
```

**Step 2: Commit and push**

Use one focused housekeeping commit after verification passes.
