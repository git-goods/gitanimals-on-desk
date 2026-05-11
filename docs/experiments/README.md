# Experiments

This directory holds reproducible before/after experiments for workflow comparisons such as `baseline` vs `with-omx`.

## Standard Flow

1. Create or update an experiment folder under `docs/experiments/<slug>/`.
2. Define the task batch and acceptance tests on the harness branch first.
3. Commit the harness-only setup.
4. Create `baseline` and `with-omx` worktrees from that exact harness commit.
5. Execute the same task manifest in both branches.
6. Fill both result JSON files and copy the PR summary block into the PR descriptions.

## Required Artifacts

- `README.md`
- `task-manifest.json`
- `kpi-schema.json`
- `commands.md`
- `results/baseline.json`
- `results/with-omx.json`
- `results/pr-summary.md`

## First Experiment

- [omx-vs-baseline-batch-01](./omx-vs-baseline-batch-01/README.md)
