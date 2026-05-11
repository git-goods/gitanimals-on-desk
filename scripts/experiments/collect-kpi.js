#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function parseArgs(argv) {
  const out = {
    verificationCommands: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--result":
        out.result = next;
        i += 1;
        break;
      case "--base-ref":
        out.baseRef = next;
        i += 1;
        break;
      case "--token-source":
        out.tokenSource = next;
        i += 1;
        break;
      case "--tasks-total":
        out.tasksTotal = next;
        i += 1;
        break;
      case "--tasks-succeeded":
        out.tasksSucceeded = next;
        i += 1;
        break;
      case "--tests-passed":
        out.testsPassed = next;
        i += 1;
        break;
      case "--tests-total":
        out.testsTotal = next;
        i += 1;
        break;
      case "--input-tokens":
        out.inputTokens = next;
        i += 1;
        break;
      case "--output-tokens":
        out.outputTokens = next;
        i += 1;
        break;
      case "--wall-clock-minutes":
        out.wallClockMinutes = next;
        i += 1;
        break;
      case "--turn-count":
        out.turnCount = next;
        i += 1;
        break;
      case "--tool-call-count":
        out.toolCallCount = next;
        i += 1;
        break;
      case "--verification-command":
        out.verificationCommands.push(next);
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!out.result) throw new Error("--result is required");
  return out;
}

function toInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Expected non-negative integer, got: ${value}`);
  return n;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseFloat(String(value));
  if (!Number.isFinite(n) || n < 0) throw new Error(`Expected non-negative number, got: ${value}`);
  return n;
}

function parseNumstat(text) {
  const rows = text.split("\n").filter(Boolean);
  let filesChanged = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  for (const row of rows) {
    const cols = row.split("\t");
    if (cols.length < 3) continue;
    filesChanged += 1;
    if (cols[0] !== "-") linesAdded += Number.parseInt(cols[0], 10) || 0;
    if (cols[1] !== "-") linesDeleted += Number.parseInt(cols[1], 10) || 0;
  }
  return { filesChanged, linesAdded, linesDeleted };
}

function getDiffStats(baseRef) {
  const args = baseRef ? ["diff", "--numstat", baseRef] : ["diff", "--numstat"];
  const text = execFileSync("git", args, { encoding: "utf8" });
  return parseNumstat(text);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function applyMetrics(result, cli, diffStats) {
  result.token_source = cli.tokenSource || result.token_source || "manual";
  result.tasks_total = toInteger(cli.tasksTotal);
  result.tasks_succeeded = toInteger(cli.tasksSucceeded);
  result.tests_passed = toInteger(cli.testsPassed);
  result.tests_total = toInteger(cli.testsTotal);
  result.input_tokens = toInteger(cli.inputTokens);
  result.output_tokens = toInteger(cli.outputTokens);
  result.total_tokens =
    result.input_tokens !== null && result.output_tokens !== null
      ? result.input_tokens + result.output_tokens
      : null;
  result.wall_clock_minutes = toNumber(cli.wallClockMinutes);
  result.turn_count = toInteger(cli.turnCount);
  result.tool_call_count = toInteger(cli.toolCallCount);
  result.files_changed = diffStats.filesChanged;
  result.lines_added = diffStats.linesAdded;
  result.lines_deleted = diffStats.linesDeleted;
  if (cli.verificationCommands.length) {
    result.verification_commands = cli.verificationCommands.slice();
  }
  return result;
}

function main(argv) {
  const cli = parseArgs(argv);
  const resultPath = path.resolve(cli.result);
  const result = loadJson(resultPath);
  const diffStats = getDiffStats(cli.baseRef);
  applyMetrics(result, cli, diffStats);
  writeJson(resultPath, result);
  process.stdout.write(`${resultPath}\n`);
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  applyMetrics,
  getDiffStats,
  parseArgs,
  parseNumstat,
  toInteger,
  toNumber,
};
