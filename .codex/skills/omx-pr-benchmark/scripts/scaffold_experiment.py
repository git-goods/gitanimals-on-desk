#!/usr/bin/env python3
"""Scaffold a reproducible OMX vs baseline experiment folder."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


README_TEMPLATE = """# {title}

## Goal

- Compare `baseline` and `with-omx` branches for the same task set.
- Keep implementation fairness constraints fixed from the harness commit.

## Scope

- Slug: `{slug}`
- Base ref: `{base_ref}`
- Harness branch: `{harness_branch}`
- Baseline branch: `{baseline_branch}`
- OMX branch: `{omx_branch}`

## Success Criteria

- Shared acceptance tests exist before implementation starts.
- Both branches derive from the same harness commit.
- KPI result files are filled for both variants.
- PR summaries link back to this experiment folder.

## Verification

- Run repo tests relevant to the task set.
- Record exact commands in each result JSON under `verification_commands`.
- Attach any known gaps in `qualitative_notes`.
"""


COMMANDS_TEMPLATE = """# Worktree Commands

Use these commands after the harness branch is ready and committed.

```bash
git worktree add {worktree_root}/{baseline_branch} -b {baseline_branch} {harness_branch}
git worktree add {worktree_root}/{omx_branch} -b {omx_branch} {harness_branch}
```

Recommended execution order:

1. Finalize shared tests on `{harness_branch}`.
2. Commit the harness-only setup.
3. Create the two worktrees from that exact commit.
4. Run the same task manifest in both branches.
5. Fill `results/baseline.json` and `results/with-omx.json`.
6. Copy the summary block from `results/pr-summary.md` into both PRs.
"""


PR_SUMMARY_TEMPLATE = """# Benchmark Summary

## Experiment

- Slug: `{slug}`
- Base ref: `{base_ref}`
- Harness branch: `{harness_branch}`

## KPI Table

| Metric | Baseline | With OMX | Delta |
| --- | --- | --- | --- |
| Success rate | `TODO` | `TODO` | `TODO` |
| Test pass rate | `TODO` | `TODO` | `TODO` |
| Total tokens | `TODO` | `TODO` | `TODO` |
| Time (minutes) | `TODO` | `TODO` | `TODO` |
| Turns | `TODO` | `TODO` | `TODO` |
| Tool calls | `TODO` | `TODO` | `TODO` |

## Notes

- Token source:
- Verification commands:
- Known gaps:
"""


TASK_MANIFEST_TEMPLATE = {
    "experiment_slug": "",
    "goal": "",
    "task_batch": [],
    "fairness_constraints": [
        "same base commit",
        "same acceptance tests",
        "same task list",
        "same stop condition",
    ],
    "verification_commands": [],
}


RESULT_TEMPLATE = {
    "variant": "",
    "experiment_slug": "",
    "base_ref": "",
    "harness_branch": "",
    "branch_name": "",
    "token_source": "unrecorded",
    "tasks_total": None,
    "tasks_succeeded": None,
    "tests_passed": None,
    "tests_total": None,
    "input_tokens": None,
    "output_tokens": None,
    "total_tokens": None,
    "wall_clock_minutes": None,
    "turn_count": None,
    "tool_call_count": None,
    "files_changed": None,
    "lines_added": None,
    "lines_deleted": None,
    "verification_commands": [],
    "qualitative_notes": [],
}


KPI_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "OMX benchmark result",
    "type": "object",
    "required": [
        "variant",
        "experiment_slug",
        "base_ref",
        "harness_branch",
        "branch_name",
        "token_source",
    ],
    "properties": {
        "variant": {"type": "string", "enum": ["baseline", "with-omx"]},
        "experiment_slug": {"type": "string"},
        "base_ref": {"type": "string"},
        "harness_branch": {"type": "string"},
        "branch_name": {"type": "string"},
        "token_source": {"type": "string"},
        "tasks_total": {"type": ["integer", "null"], "minimum": 0},
        "tasks_succeeded": {"type": ["integer", "null"], "minimum": 0},
        "tests_passed": {"type": ["integer", "null"], "minimum": 0},
        "tests_total": {"type": ["integer", "null"], "minimum": 0},
        "input_tokens": {"type": ["integer", "null"], "minimum": 0},
        "output_tokens": {"type": ["integer", "null"], "minimum": 0},
        "total_tokens": {"type": ["integer", "null"], "minimum": 0},
        "wall_clock_minutes": {"type": ["number", "null"], "minimum": 0},
        "turn_count": {"type": ["integer", "null"], "minimum": 0},
        "tool_call_count": {"type": ["integer", "null"], "minimum": 0},
        "files_changed": {"type": ["integer", "null"], "minimum": 0},
        "lines_added": {"type": ["integer", "null"], "minimum": 0},
        "lines_deleted": {"type": ["integer", "null"], "minimum": 0},
        "verification_commands": {"type": "array", "items": {"type": "string"}},
        "qualitative_notes": {"type": "array", "items": {"type": "string"}},
    },
    "additionalProperties": False,
}


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slug", help="Experiment slug, for example state-machine-batch-01")
    parser.add_argument("--root", default="docs/experiments", help="Experiment root directory")
    parser.add_argument("--title", default=None, help="Human-readable title")
    parser.add_argument("--base-ref", default="main", help="Base commit or branch for the harness")
    parser.add_argument("--harness-branch", default=None, help="Harness branch name")
    parser.add_argument("--baseline-branch", default=None, help="Baseline branch name")
    parser.add_argument("--omx-branch", default=None, help="OMX branch name")
    parser.add_argument("--worktree-root", default="../worktrees", help="Parent directory for worktrees")
    args = parser.parse_args()

    slug = args.slug.strip()
    title = args.title or slug.replace("-", " ").title()
    harness_branch = args.harness_branch or f"exp/{slug}-harness"
    baseline_branch = args.baseline_branch or f"exp/{slug}-baseline"
    omx_branch = args.omx_branch or f"exp/{slug}-with-omx"

    experiment_dir = Path(args.root) / slug
    results_dir = experiment_dir / "results"

    readme = README_TEMPLATE.format(
        title=title,
        slug=slug,
        base_ref=args.base_ref,
        harness_branch=harness_branch,
        baseline_branch=baseline_branch,
        omx_branch=omx_branch,
    )
    commands = COMMANDS_TEMPLATE.format(
        worktree_root=args.worktree_root.rstrip("/"),
        baseline_branch=baseline_branch,
        omx_branch=omx_branch,
        harness_branch=harness_branch,
    )
    pr_summary = PR_SUMMARY_TEMPLATE.format(
        slug=slug,
        base_ref=args.base_ref,
        harness_branch=harness_branch,
    )

    task_manifest = dict(TASK_MANIFEST_TEMPLATE)
    task_manifest["experiment_slug"] = slug
    task_manifest["goal"] = f"Benchmark OMX vs baseline for {title}"

    baseline_result = dict(RESULT_TEMPLATE)
    baseline_result.update(
        {
            "variant": "baseline",
            "experiment_slug": slug,
            "base_ref": args.base_ref,
            "harness_branch": harness_branch,
            "branch_name": baseline_branch,
        }
    )
    omx_result = dict(RESULT_TEMPLATE)
    omx_result.update(
        {
            "variant": "with-omx",
            "experiment_slug": slug,
            "base_ref": args.base_ref,
            "harness_branch": harness_branch,
            "branch_name": omx_branch,
        }
    )

    write_text(experiment_dir / "README.md", readme)
    write_text(experiment_dir / "commands.md", commands)
    write_text(results_dir / "pr-summary.md", pr_summary)
    write_json(experiment_dir / "task-manifest.json", task_manifest)
    write_json(experiment_dir / "kpi-schema.json", KPI_SCHEMA)
    write_json(results_dir / "baseline.json", baseline_result)
    write_json(results_dir / "with-omx.json", omx_result)

    print(f"Scaffolded experiment at {experiment_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
