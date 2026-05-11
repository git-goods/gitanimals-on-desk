# Worktree Commands

Use these commands after the harness branch is ready and committed.

```bash
git worktree add .worktrees/exp/omx-vs-baseline-batch-01-baseline -b exp/omx-vs-baseline-batch-01-baseline exp/omx-vs-baseline-batch-01-harness
git worktree add .worktrees/exp/omx-vs-baseline-batch-01-with-omx -b exp/omx-vs-baseline-batch-01-with-omx exp/omx-vs-baseline-batch-01-harness
```

Recommended execution order:

1. Finalize shared tests on `exp/omx-vs-baseline-batch-01-harness`.
2. Commit the harness-only setup.
3. Create the two worktrees from that exact commit.
4. Run the same task manifest in both branches.
5. Fill `results/baseline.json` and `results/with-omx.json`.
6. Copy the summary block from `results/pr-summary.md` into both PRs.

KPI collection example after verification:

```bash
npm run experiments:collect-kpi -- \
  --result docs/experiments/omx-vs-baseline-batch-01/results/with-omx.json \
  --base-ref exp/omx-vs-baseline-batch-01-harness \
  --token-source manual \
  --tasks-total 4 \
  --tasks-succeeded 4 \
  --tests-passed 150 \
  --tests-total 150 \
  --wall-clock-minutes 18.5 \
  --turn-count 12 \
  --tool-call-count 34 \
  --verification-command "node --test test/experiments/*.test.js" \
  --verification-command "node --test test/settings/*.test.js test/preload/settings-bridge.test.js" \
  --verification-command "npm run typecheck"
```
