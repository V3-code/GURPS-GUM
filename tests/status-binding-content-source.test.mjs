import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("status binding automation uses configured multi-pack sources", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");

  assert.match(main, /contentSourceService\.getDocuments\("statusBindings"\)/);
  assert.doesNotMatch(main, /getConfiguredStatusBindingsPack/);
});

test("legacy status binding setting is migrated without replacing an explicit source list", () => {
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(settings, /Object\.hasOwn\(configuredSources, "statusBindings"\)/);
  assert.match(settings, /legacyId \|\| "gum\.conditions"/);
  assert.match(settings, /contentSourceService\.setSourceIds\("statusBindings"/);
  assert.match(settings, /"statusBindingsCompendium"[\s\S]*?config: false/);
});

test("retired bundled sources are removed without discarding user libraries", () => {
  const settings = fs.readFileSync("module/settings.js", "utf8");
  const main = fs.readFileSync("scripts/main.js", "utf8");

  for (const sourceId of ["gum.modifiers", "gum.templates", "gum.eqp_modifiers", "gum.gm_modifiers", "gum.skills", "gum.gatilhos"]) {
    assert.match(settings, new RegExp(sourceId.replace(".", "\\.")));
  }
  assert.match(settings, /filter\(id => id !== retiredId\)/);
  assert.match(main, /await migrateRetiredBundledSources\(\)/);
});
