const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

describe("settings renderer migration harness", () => {
  it("keeps settings.html pointed at the compiled renderer.js entry", () => {
    const html = read("src/settings/settings.html");
    assert.match(html, /<script src="renderer\.js"><\/script>/);
  });

  it("tracks a TSX source file for the settings renderer", () => {
    assert.ok(fs.existsSync(path.join(root, "src/settings/renderer.tsx")));
  });

  it("includes renderer.tsx in typecheck and transpile source configs", () => {
    const baseConfig = readJson("tsconfig.json");
    const sourceConfig = readJson("tsconfig.sources.json");
    assert.ok(baseConfig.include.includes("src/settings/renderer.tsx"));
    assert.ok(sourceConfig.include.includes("src/settings/renderer.tsx"));
  });
});
