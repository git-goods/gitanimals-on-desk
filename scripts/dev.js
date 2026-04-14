#!/usr/bin/env node
// Launch mock theme server + Electron app together.
// Ctrl+C (or either process exiting) terminates both.

const { spawn } = require("child_process");
const path = require("path");

const children = [];
let shuttingDown = false;

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (reason) console.log(`\n[dev] ${reason} — stopping all`);
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}

function spawnChild(label, cmd, args) {
  const c = spawn(cmd, args, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  children.push(c);
  c.on("exit", (code) => shutdown(`${label} exited (${code})`));
  c.on("error", (err) => shutdown(`${label} error: ${err.message}`));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

spawnChild("mock-server", "python3", ["-m", "http.server", "--directory", ".mock-server", "8765"]);
spawnChild("app", "node", ["launch.js"]);
