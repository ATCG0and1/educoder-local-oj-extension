# Local-Fail Submit Confirmation Design

## Goal

Keep the normal `提交评测` flow available after a local failure, but require an explicit confirmation before the extension submits to Educoder.

## Decisions

- Keep `educoderLocalOj.submitTask` as the primary button and preserve the current save-before-submit behavior.
- Keep `educoderLocalOj.forceRunOfficialJudge` unchanged as the advanced force path.
- Add a confirmation callback inside `submitTaskFlow` so the local judge only runs once per submit attempt.
- When the user cancels, keep the existing stopped-local-failure report and toast behavior.
- When the user confirms, continue with a normal remote submit using `force: false`.

## UI

- On local compile error or local case failure, show a warning confirmation before remote submission.
- On the dashboard, show a short hint that local failures can still be submitted with confirmation.

## Testing

- Add unit coverage for confirmed submit after local failure.
- Add command-level coverage for confirm-and-submit and cancel-and-stop behavior.
