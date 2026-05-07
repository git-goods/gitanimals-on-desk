"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Confirms the bundled-theme ↔ persona-sync ID mapping introduced to dedupe
// the theme list. The loader exposes `personaTypeToThemeId(personaType)` —
// persona-sync routes its cache id through that map so e.g. "DESSERT_FOX"
// resolves to the bundled "fox" theme instead of synthesising "dessert_fox".

const themeLoader = require("../src/theme/loader");
const personaSync = require("../src/theme/persona-sync");

describe("persona-sync ↔ bundled theme mapping", () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-sync-map-"));
    // Mimic real bootstrap: loader first (so personaTypeMap is populated from
    // bundled themes/), then persona-sync pointed at a fresh cache dir.
    themeLoader.init(path.join(__dirname, "..", "src"), tmpDir);
    personaSync.init(tmpDir);
  });

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) {}
  });

  it("loader.personaTypeToThemeId() maps bundled persona types to bundled ids", () => {
    assert.strictEqual(themeLoader.personaTypeToThemeId("DESSERT_FOX"), "fox");
    assert.strictEqual(themeLoader.personaTypeToThemeId("CAPYBARA_CARROT"), "capybara-carrot");
    assert.strictEqual(themeLoader.personaTypeToThemeId("RABBIT"), "rabbit");
    assert.strictEqual(themeLoader.personaTypeToThemeId("LITTLE_CHICK"), "little-chick");
  });

  it("loader.personaTypeToThemeId() returns null for unknown persona types", () => {
    assert.strictEqual(themeLoader.personaTypeToThemeId("UNKNOWN_PET"), null);
    assert.strictEqual(themeLoader.personaTypeToThemeId(""), null);
    // @ts-expect-error — non-string
    assert.strictEqual(themeLoader.personaTypeToThemeId(undefined), null);
  });

  it("loadCachedPersonas() normalizes legacy ids and dedupes duplicates", () => {
    // Simulate a `.personas.json` written by a previous version: ids use the
    // old underscore convention and the API duplicated several entries.
    // persona-sync.init() resolves the cache to `<userDataDir>/theme-cache`.
    const cacheDir = path.join(tmpDir, "theme-cache");
    fs.mkdirSync(cacheDir, { recursive: true });
    const personasPath = path.join(cacheDir, ".personas.json");
    fs.writeFileSync(personasPath, JSON.stringify({
      fetchedAt: Date.now(),
      personas: [
        { id: "dessert_fox",      name: "DESSERT_FOX",      personaType: "DESSERT_FOX",      previewUrl: null },
        { id: "dessert_fox",      name: "DESSERT_FOX",      personaType: "DESSERT_FOX",      previewUrl: null },
        { id: "capybara_carrot",  name: "CAPYBARA_CARROT",  personaType: "CAPYBARA_CARROT",  previewUrl: null },
        { id: "rabbit",           name: "RABBIT",           personaType: "RABBIT",           previewUrl: null },
        { id: "rabbit",           name: "RABBIT",           personaType: "RABBIT",           previewUrl: null },
        { id: "little_chick",     name: "LITTLE_CHICK",     personaType: "LITTLE_CHICK",     previewUrl: null },
      ],
    }), "utf8");

    const ids = personaSync.loadCachedPersonas().map((p) => p.id);
    // Sorted to be order-independent — internal dedupe preserves first-seen,
    // but the assertion just needs the canonical set.
    assert.deepStrictEqual(ids.slice().sort(), ["capybara-carrot", "fox", "little-chick", "rabbit"]);
  });
});
