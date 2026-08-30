import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const english = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
const resolve = key => key.split(".").reduce((value, part) => value?.[part], english) ?? key;

test("system setting labels and choices follow the active language", async () => {
  const previousGame = globalThis.game;
  const previousHooks = globalThis.Hooks;
  const registrations = new Map();
  globalThis.game = {
    i18n: {
      localize: resolve,
      format: (key, data) => Object.entries(data).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), resolve(key))
    },
    settings: { register: (_namespace, id, config) => registrations.set(id, config) }
  };
  globalThis.Hooks = { on: () => {} };
  try {
    const { registerSystemSettings } = await import("../module/settings.js");
    registerSystemSettings();
    assert.equal(registrations.get("initiativeFormula").name, "Initiative Formula (GUM)");
    assert.equal(registrations.get("initiativeFormula").hint.includes("Basic Speed"), true);
    assert.equal(registrations.get("autoDistanceModifierEnabled").name, "Range Modifier");
    assert.deepEqual(registrations.get("autoDistanceModifierTable").choices, {
      standard: "Standard (GURPS)",
      monster_hunters: "Condensed (Monster Hunters)",
      hybrid: "Hybrid (MH + Standard)"
    });
    assert.equal(registrations.get("importGCSButton").name, "Import GCS Character");
    assert.equal(registrations.get("exportCharacterJSONButton").name, "Export Character Sheet (JSON)");
  } finally {
    globalThis.game = previousGame;
    globalThis.Hooks = previousHooks;
  }
});
