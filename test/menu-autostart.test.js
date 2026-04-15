const { describe, it } = require("node:test");
const assert = require("node:assert");

const { getLoginItemSettings } = require("../src/login-item");

describe("login item settings", () => {
  it("includes the app path when enabling login items for an unpackaged Windows app", () => {
    const settings = getLoginItemSettings({
      isPackaged: false,
      openAtLogin: true,
      execPath: "D:\\gitanimals-on-desk\\node_modules\\electron\\dist\\electron.exe",
      appPath: "D:\\gitanimals-on-desk",
    });

    assert.deepStrictEqual(settings, {
      openAtLogin: true,
      path: "D:\\gitanimals-on-desk\\node_modules\\electron\\dist\\electron.exe",
      args: ["D:\\gitanimals-on-desk"],
    });
  });

  it("uses the default packaged login item settings", () => {
    const settings = getLoginItemSettings({
      isPackaged: true,
      openAtLogin: true,
      execPath: "C:\\Program Files\\GitAnimals on Desk\\GitAnimals on Desk.exe",
      appPath: "C:\\Program Files\\GitAnimals on Desk\\resources\\app.asar",
    });

    assert.deepStrictEqual(settings, { openAtLogin: true });
  });

  it("includes the app path when disabling login items for an unpackaged app", () => {
    const settings = getLoginItemSettings({
      isPackaged: false,
      openAtLogin: false,
      execPath: "D:\\gitanimals-on-desk\\node_modules\\electron\\dist\\electron.exe",
      appPath: "D:\\gitanimals-on-desk",
    });

    assert.deepStrictEqual(settings, {
      openAtLogin: false,
      path: "D:\\gitanimals-on-desk\\node_modules\\electron\\dist\\electron.exe",
      args: ["D:\\gitanimals-on-desk"],
    });
  });

});
