# OMX vs Baseline Batch 01

## Goal

- Compare `baseline` and `with-omx` branches for the same task set.
- Keep implementation fairness constraints fixed from the harness commit.
- Review the resulting code and KPI evidence directly from two PRs.
- Target task: convert the settings panel UI from the current ad hoc renderer script into a React-managed JSX or TSX implementation.

## Scope

- Slug: `omx-vs-baseline-batch-01`
- Base ref: `main`
- Harness branch: `exp/omx-vs-baseline-batch-01-harness`
- Baseline branch: `exp/omx-vs-baseline-batch-01-baseline`
- OMX branch: `exp/omx-vs-baseline-batch-01-with-omx`

## Success Criteria

- Shared acceptance tests exist before implementation starts.
- Both branches derive from the same harness commit.
- KPI result files are filled for both variants.
- PR summaries link back to this experiment folder.
- The same verification commands run in both branches.

## Verification

- Run repo checks relevant to the task set.
- Record exact commands in each result JSON under `verification_commands`.
- Attach any known gaps in `qualitative_notes`.

Recommended default checks for this repository:

- `npm test`
- `npm run typecheck`
- Add any task-specific smoke or targeted tests to `task-manifest.json` before branching.

Task-specific anchors for this batch:

- Settings entry surface: [src/settings/settings.html](/Users/sumi/Documents/repo/personal/clawd-on-desk/src/settings/settings.html)
- Current renderer: [src/settings/renderer.js](/Users/sumi/Documents/repo/personal/clawd-on-desk/src/settings/renderer.js)
- Preload API contract: [src/preload/settings-bridge.ts](/Users/sumi/Documents/repo/personal/clawd-on-desk/src/preload/settings-bridge.ts)
- Existing settings tests: [test/settings](/Users/sumi/Documents/repo/personal/clawd-on-desk/test/settings), [test/preload/settings-bridge.test.js](/Users/sumi/Documents/repo/personal/clawd-on-desk/test/preload/settings-bridge.test.js)

## Recommended Batch Shape

Use one experiment batch for one coherent slice of work, not for unrelated edits.

Good candidates:

- several related bug fixes in one subsystem
- one refactor with clear acceptance tests
- one feature slice with 5-15 concrete subtasks

Avoid:

- tiny one-line fixes
- mixed packaging, UI, and hook work in the same batch
- branches that change acceptance criteria midway

## Branch Roles

- `exp/omx-vs-baseline-batch-01-harness`
  Contains only the shared benchmark setup, task manifest, and tests.
- `exp/omx-vs-baseline-batch-01-baseline`
  Executes the same task batch without OMX workflow assistance.
- `exp/omx-vs-baseline-batch-01-with-omx`
  Executes the same task batch with OMX workflow assistance.

## Task-Specific Acceptance

See [acceptance-checklist.md](./acceptance-checklist.md).
