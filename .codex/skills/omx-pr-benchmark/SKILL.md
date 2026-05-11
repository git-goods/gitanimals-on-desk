---
name: omx-pr-benchmark
description: Create and run before/after engineering experiments that compare OMX-assisted work against a non-OMX baseline using the same repo state, shared acceptance tests, KPI capture, worktrees, and PR-ready evidence. Use when Codex needs to set up or execute an A/B style workflow for features, refactors, bugfixes, or multi-task batches where token usage, time, test pass rate, and output quality must be reviewed quantitatively in pull requests.
---

# OMX PR Benchmark

Use this skill to turn "compare OMX vs no OMX" into a reproducible engineering experiment.

## Workflow

1. Define the experiment slug, target feature set, base commit, and success criteria.
2. Run `scripts/scaffold_experiment.py` to create the experiment folder, KPI schema, result templates, and worktree command plan.
3. Add or tighten acceptance tests before implementation. Keep these tests identical for both variants.
4. Create an `eval-harness` branch/PR first. This branch holds only the shared benchmark setup: task manifest, tests, KPI schema, and reporting templates.
5. From the harness commit, create two worktrees:
   - `baseline`: same task set without OMX workflow help
   - `with-omx`: same task set with OMX workflow help
6. Keep the comparison fair:
   - same base commit
   - same task manifest
   - same model and reasoning settings where possible
   - same time budget or stop condition
   - same tests and verification commands
7. Capture results for each branch in the experiment `results/` folder. Fill in token, time, turn, tool, and test metrics.
8. Generate or update PR summaries using the template in `references/pr-template.md`. Link the experiment folder from both PRs.

## Execution Rules

- Treat the `eval-harness` branch as the source of truth for experiment rules.
- Do not compare branches that diverged from different commits.
- Prefer task batches large enough to reduce noise. A single tiny fix rarely produces stable conclusions.
- When token counts are unavailable automatically, record `token_source` and leave numeric fields null instead of inventing values.
- Separate objective metrics from judgment calls. Put human review notes in `qualitative_notes`, not in KPI totals.
- If the repo already has CI or test scripts, reuse them instead of inventing benchmark-specific checks.

## KPI Minimum Set

Always record:

- `tasks_total`
- `tasks_succeeded`
- `tests_passed`
- `tests_total`
- `input_tokens`
- `output_tokens`
- `total_tokens`
- `wall_clock_minutes`
- `turn_count`
- `tool_call_count`
- `files_changed`
- `lines_added`
- `lines_deleted`

Derived metrics to report in PR text:

- `success_rate`
- `test_pass_rate`
- `token_per_success`
- `time_per_success`

See `references/kpi-schema.md` for definitions and comparison rules.

## Files This Skill Creates

- `docs/experiments/<slug>/README.md`
- `docs/experiments/<slug>/task-manifest.json`
- `docs/experiments/<slug>/kpi-schema.json`
- `docs/experiments/<slug>/commands.md`
- `docs/experiments/<slug>/results/baseline.json`
- `docs/experiments/<slug>/results/with-omx.json`
- `docs/experiments/<slug>/results/pr-summary.md`

## Resources

- `scripts/scaffold_experiment.py`
  Create benchmark folders and starter files.
- `references/kpi-schema.md`
  Definitions for required metrics, fairness rules, and interpretation.
- `references/pr-template.md`
  Pull request body structure for benchmark evidence.

## Completion Standard

Do not call the experiment ready until:

- the harness branch contains shared tests and result templates
- both comparison branches point back to the same harness commit
- result JSON files exist for both variants
- PR text shows KPI values, verification commands, and known gaps
