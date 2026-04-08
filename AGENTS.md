# AGENTS.md

## Project Status

- **Canonical local workspace:** `C:\Users\钟宇阳\educoder_recon\educoder-local-oj-extension`
- **Canonical remote repo:** `https://github.com/zyylovelyyso/educoder-local-oj-extension`
- **Current public release:** `v0.0.1`
- **Canonical branch:** `main`
- **Current baseline:** the recovered stash snapshot has been promoted to the public repository; temporary recovery directories must not become long-term working roots
- **Legacy compatibility policy:** old task folder layouts stay supported in code, but internal migration details should not be used as README marketing copy

---

## Non-Negotiable Rules

1. **Only one canonical workspace**
   - Work from `C:\Users\钟宇阳\educoder_recon\educoder-local-oj-extension`
   - Do not keep developing in `*-recovered`, `*-clean`, or other throwaway copies

2. **No dirty-tree releases**
   - Never package or release from a dirty git state
   - `git status --short` must be empty before release tagging

3. **Strict version discipline**
   - Functional/user-visible changes must update `package.json` version
   - The same change must update `CHANGELOG.md`
   - Release tags must use `v<package.json version>`
   - GitHub Release assets must be built from that tagged commit

4. **Docs-only changes do not force a version bump**
   - README / AGENTS / CI / housekeeping-only commits may stay unreleased
   - Do not create a new tag just for internal notes unless explicitly requested

5. **Legacy-safe compatibility**
   - When touching old task roots, prefer forward migration/copying
   - Do not strongly delete legacy task files as part of migration logic
   - Verify canonical files are written before treating migration as complete

6. **Verification before completion**
   - Before claiming success, run fresh verification
   - Standard local gate:
     - `npm run verify`
     - `npm run release:check`
   - Release gate:
     - `npm run package:vsix`
     - `npm run release:check:tagged`

7. **Keep the packaged VSIX minimal**
   - Internal notes, scripts, recovery docs, and agent instructions must not be shipped inside the VSIX
   - `.vscodeignore` is part of the release contract

---

## Default Working Checklist

### For normal changes

1. Create or switch to the intended branch
2. Make the change
3. Run:
   - `npm run verify`
   - `npm run release:check`
4. Update docs if product behavior changed
5. Commit with a focused message

### For release changes

1. Bump `package.json` version
2. Update `CHANGELOG.md`
3. Run:
   - `npm run verify`
   - `npm run release:check`
   - `npm run package:vsix`
4. Create tag `v<version>`
5. Run `npm run release:check:tagged`
6. Publish GitHub Release and upload the VSIX

---

## Repository Boundaries

- Commands: `src/commands/*`
- Sync/package assembly: `src/core/sync/*`, `src/core/workspace/*`
- Local judge: `src/core/judge/*`
- Remote judge/submit: `src/core/remote/*`
- UI/state: `src/core/ui/*`, `src/views/*`, `src/webview/*`
- Auth/runtime/API: `src/core/auth/*`, `src/core/runtime/*`, `src/core/api/*`

If future work changes actual product behavior, keep this file aligned with reality.
