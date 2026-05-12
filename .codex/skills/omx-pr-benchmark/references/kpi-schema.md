# KPI Definitions

Use these fields for every `baseline` and `with-omx` result JSON.

## Fairness Rules

- Start both branches from the same harness commit.
- Keep the task manifest identical.
- Keep acceptance tests identical.
- Keep verification commands identical unless the repo state forces a documented exception.
- If a metric is unavailable, store `null` and explain the gap in `qualitative_notes`.

## Required Metrics

- `tasks_total`
  Number of planned tasks in the batch.
- `tasks_succeeded`
  Number of tasks completed to the stated acceptance criteria.
- `tests_passed`
  Number of passing tests from the benchmark verification run.
- `tests_total`
  Total tests executed in that same verification run.
- `input_tokens`
  Prompt-side tokens consumed during the branch execution.
- `output_tokens`
  Model-output tokens consumed during the branch execution.
- `total_tokens`
  `input_tokens + output_tokens`.
- `wall_clock_minutes`
  Elapsed human-clock time from branch start to stop condition.
- `turn_count`
  Count of user/agent turns used to finish the task batch.
- `tool_call_count`
  Count of tool invocations or shell commands, based on the chosen logging source.
- `files_changed`
  Git-tracked file count changed by the branch.
- `lines_added`
  Sum of added lines in the final diff.
- `lines_deleted`
  Sum of deleted lines in the final diff.

## Derived Metrics

- `success_rate = tasks_succeeded / tasks_total`
- `test_pass_rate = tests_passed / tests_total`
- `token_per_success = total_tokens / tasks_succeeded`
- `time_per_success = wall_clock_minutes / tasks_succeeded`

Do not store derived metrics in the JSON unless your workflow explicitly needs them. They are presentation metrics for PR text and reports.

## Recommended Interpretation

- Prefer `success_rate` and `test_pass_rate` over raw diff size.
- Use token and time metrics only alongside correctness metrics.
- A lower token count is not a win if the branch fails tests or leaves larger known gaps.
- For very small tasks, summarize noise risk in `qualitative_notes`.
