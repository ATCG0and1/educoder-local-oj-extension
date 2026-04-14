# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.0.8] - 2026-04-14

### Fixed

- expanded local judge environment-noise handling for missing helper scripts so `memory.sh`-missing stderr and trailing `time=..., mem=...` lines no longer trigger false local failures when the expected output body already matches

## [0.0.7] - 2026-04-13

### Fixed

- stopped normal task open/full-sync flows from auto-unlocking Educoder reference answers, so daily solving no longer triggers answer unlock side effects before the user explicitly requests a full answer sync
- split answer sync into a non-unlocking path for embedded answer bodies and a warning-gated `完整同步答案（可能影响评分）` path for explicit full unlocks

## [0.0.6] - 2026-04-13

### Fixed

- refreshed official-submit metadata from `/api/tasks/:taskId.json` right before remote judging, so `myshixun/game/challenge/user/editablePaths` no longer rely solely on stale local cache and submit-side runtime fields stay aligned with the latest Educoder task session

## [0.0.5] - 2026-04-13

### Fixed

- added a `完整报错` action in the task workbench so compile failures can open the full raw diagnostics directly from `_educoder/judge/latest_compile_error.log`
- added an explicit `0/N` compile-failure headline in local summaries when hidden test counts are known, so compile failures match headguy-style result cues more closely
- hardened local judging against environment-specific checker noise (e.g. missing `/data/workspace/myshixun/.../check.py`) so known auxiliary script mismatches no longer produce false local failures in header-based harness tasks

## [0.0.4] - 2026-04-12

### Fixed

- made local compile failures prefer the first GCC-style `file:line:column: error: ...` block instead of showing only generic function-context lines
- aligned local compile-failure summaries and explicit toast notifications so they both preserve the first code line and caret line from the compiler output
- let `提交评测` continue after a local failure when the user explicitly confirms, while keeping `强制提交到头哥` as the separate force path
- surfaced a clearer dashboard hint that local failures can still be submitted to Educoder with a confirmation step

### Housekeeping

- cleaned the local workspace promotion flow so the canonical repo can stay on the stable old path
- added `AGENTS.md`, `CHANGELOG.md`, `.gitattributes`, and a release-state check script
- removed internal compatibility wording from the public README
- made `vitest` run in a single fork so the shared VS Code extension activation mock stays stable during release verification on Windows

## [0.0.3] - 2026-04-11

### Fixed

- normalized plain-code answer markdown into fenced code blocks so answer preview keeps line breaks instead of collapsing into one paragraph
- normalized statement sample blocks before markdown preview so multi-line sample input and output render correctly in VS Code
- stopped local-test and submit notifications from blocking the dashboard progress indicator until the toast is dismissed

## [0.0.2] - 2026-04-11

### Fixed

- normalized local judge output comparison so CRLF and trailing-whitespace-only differences no longer cause false local failures
- made local failure and pending-submit summaries easier to read in the task workbench
- preserved HTML-only problem statements without writing misleading `statement.md` files that flatten original sample layout
- narrowed local compile source planning to editable scopes and recorded the actual compile inputs for clearer workspace/path diagnostics
- cleaned the task tree header actions into icon buttons, removed the unclear sidebar refresh button, and tightened the task card styling for a more consistent workbench layout
- renamed the answer entry in the task card to `打开答案`

## [0.0.1] - 2026-04-08

### Added

- initial public release of the Educoder Local OJ VS Code extension
- local task package workflow with task tree, local judge, submit flow, and compatibility migration logic
