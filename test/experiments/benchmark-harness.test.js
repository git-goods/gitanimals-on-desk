const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const experimentDir = path.join(root, "docs", "experiments", "omx-vs-baseline-batch-01");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

describe("benchmark harness artifacts", () => {
  it("contains the required experiment files", () => {
    const required = [
      "README.md",
      "acceptance-checklist.md",
      "commands.md",
      "kpi-schema.json",
      "task-manifest.json",
      path.join("results", "baseline.json"),
      path.join("results", "with-omx.json"),
      path.join("results", "pr-summary.md"),
    ];
    for (const rel of required) {
      assert.ok(fs.existsSync(path.join(experimentDir, rel)), rel);
    }
  });

  it("keeps both result variants aligned with the same experiment slug", () => {
    const baseline = readJson("docs/experiments/omx-vs-baseline-batch-01/results/baseline.json");
    const withOmx = readJson("docs/experiments/omx-vs-baseline-batch-01/results/with-omx.json");
    assert.strictEqual(baseline.variant, "baseline");
    assert.strictEqual(withOmx.variant, "with-omx");
    assert.strictEqual(baseline.experiment_slug, withOmx.experiment_slug);
    assert.strictEqual(baseline.harness_branch, withOmx.harness_branch);
  });

  it("defines default verification commands in the task manifest", () => {
    const manifest = readJson("docs/experiments/omx-vs-baseline-batch-01/task-manifest.json");
    assert.ok(Array.isArray(manifest.verification_commands));
    assert.ok(manifest.verification_commands.includes("node --test test/experiments/*.test.js"));
    assert.ok(manifest.verification_commands.includes("npm test"));
    assert.ok(manifest.verification_commands.includes("npm run typecheck"));
  });
});
