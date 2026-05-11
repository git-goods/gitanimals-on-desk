const { describe, it } = require("node:test");
const assert = require("node:assert");

const {
  applyMetrics,
  parseNumstat,
  toInteger,
  toNumber,
} = require("../../scripts/experiments/collect-kpi");

describe("collect-kpi helpers", () => {
  it("parses git numstat output into diff totals", () => {
    const stats = parseNumstat([
      "10\t2\tsrc/foo.js",
      "3\t0\ttest/foo.test.js",
      "-\t-\tassets/icon.png",
    ].join("\n"));
    assert.deepStrictEqual(stats, {
      filesChanged: 3,
      linesAdded: 13,
      linesDeleted: 2,
    });
  });

  it("normalizes numeric inputs", () => {
    assert.strictEqual(toInteger("5"), 5);
    assert.strictEqual(toInteger(""), null);
    assert.strictEqual(toNumber("2.5"), 2.5);
    assert.strictEqual(toNumber(undefined), null);
  });

  it("applies CLI metrics and computes total tokens", () => {
    const result = {
      token_source: "manual",
      verification_commands: [],
    };
    applyMetrics(result, {
      tokenSource: "codex-jsonl",
      tasksTotal: "5",
      tasksSucceeded: "4",
      testsPassed: "10",
      testsTotal: "11",
      inputTokens: "100",
      outputTokens: "40",
      wallClockMinutes: "12.5",
      turnCount: "9",
      toolCallCount: "14",
      verificationCommands: ["npm test"],
    }, {
      filesChanged: 7,
      linesAdded: 80,
      linesDeleted: 25,
    });

    assert.deepStrictEqual(result, {
      token_source: "codex-jsonl",
      tasks_total: 5,
      tasks_succeeded: 4,
      tests_passed: 10,
      tests_total: 11,
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
      wall_clock_minutes: 12.5,
      turn_count: 9,
      tool_call_count: 14,
      files_changed: 7,
      lines_added: 80,
      lines_deleted: 25,
      verification_commands: ["npm test"],
    });
  });
});
