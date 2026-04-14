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

// Wait for mock server to bind before launching app (avoids sync race)
const net = require("net");
function waitForPort(port, retries = 20) {
  return new Promise((resolve) => {
    (function attempt(n) {
      const sock = net.createConnection(port, "127.0.0.1");
      sock.on("connect", () => { sock.destroy(); resolve(); });
      sock.on("error", () => { n > 0 ? setTimeout(() => attempt(n - 1), 150) : resolve(); });
    })(retries);
  });
}
waitForPort(8765).then(() => spawnChild("app", "node", ["launch.js"]));
