# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Housekeeping

- cleaned the local workspace promotion flow so the canonical repo can stay on the stable old path
- added `AGENTS.md`, `CHANGELOG.md`, `.gitattributes`, and a release-state check script
- removed internal compatibility wording from the public README

## [0.0.4] - 2026-04-12

### Fixed

- made local compile failures prefer the first GCC-style `file:line:column: error: ...` block instead of showing only generic function-context lines
- aligned local compile-failure summaries and explicit toast notifications so they both preserve the first code line and caret line from the compiler output

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
