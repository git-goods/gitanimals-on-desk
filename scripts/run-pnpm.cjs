#!/usr/bin/env node

const path = require("node:path");
const { spawn } = require("node:child_process");

const args = process.argv.slice(2);

let cwd = process.cwd();
if (args[0] === "--dir") {
  if (!args[1]) {
    console.error("Missing value for --dir");
    process.exit(1);
  }
  cwd = path.resolve(process.cwd(), args[1]);
  args.splice(0, 2);
}

if (args.length === 0) {
  console.error("Missing pnpm arguments");
  process.exit(1);
}

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(pnpmCommand, args, {
  cwd,
  env: { ...process.env, COREPACK_ENABLE_STRICT: "0" },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
