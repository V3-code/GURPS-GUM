import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("status binding automation uses configured multi-pack sources", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");

  assert.match(main, /contentSourceService\.getDocuments\("statusBindings"\)/);
  assert.doesNotMatch(main, /getConfiguredStatusBindingsPack/);
  assert.match(main, /worldConfiguration\.bindingsMigrated/);
  assert.match(main, /buildWorldStatusBindingRules/);
});

test("world status configuration is registered as a restricted settings menu", () => {
  const settings = fs.readFileSync("module/settings.js", "utf8");
  const app = fs.readFileSync("module/apps/world-status-config.js", "utf8");
  const template = fs.readFileSync("templates/apps/world-status-config.hbs", "utf8");

  assert.match(settings, /registerMenu\("gum", "worldStatusConfig"/);
  assert.match(settings, /restricted: true/);
  assert.match(settings, /applyWorldStatusConfiguration/);
  assert.match(app, /new EffectBrowser/);
  assert.match(app, /saveDataToFile/);
  assert.match(app, /collectWorldStatusActors/);
  assert.match(app, /data-action=\\?"open-dependency/);
  assert.match(app, /gum-sheet-edit-dialog/);
  assert.match(app, /setSourceIds\("statusBindings", \[\]\)/);
  assert.match(template, /data-action="choose-icon"/);
  assert.match(template, /data-action="inspect-status"/);
  assert.match(template, /data-action="import"/);
  assert.match(template, /data-action="export"/);
  assert.match(template, /data-action="review-references"/);
  assert.match(template, /data-field="stackMode"/);
  assert.match(template, /data-field="stackLimit"/);
  assert.match(template, /data-field="removeOnStatusOff"/);
  assert.match(fs.readFileSync("module/apps/content-source-config.js", "utf8"), /definition\.id !== "statusBindings" \|\| !worldStatuses\.bindingsMigrated/);
  assert.match(fs.readFileSync("scripts/apps/condition-sheet.js", "utf8"), /showLegacyStatusBindingMode/);
  assert.match(fs.readFileSync("scripts/main.js", "utf8"), /gumWorldStatusConfigurationChanged/);
  assert.match(fs.readFileSync("scripts/main.js", "utf8"), /configuredEffectUuids/);
  assert.match(fs.readFileSync("scripts/main.js", "utf8"), /isStatusBindingAuthority/);
  assert.doesNotMatch(fs.readFileSync("scripts/main.js", "utf8"), /CONFIG\.statusEffects = GUM\.statusEffects/);
});

test("legacy status binding setting is migrated without replacing an explicit source list", () => {
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(settings, /Object\.hasOwn\(configuredSources, "statusBindings"\)/);
  assert.match(settings, /legacyId && legacyId !== "gum\.conditions" \? \[legacyId\] : \[\]/);
  assert.match(settings, /contentSourceService\.setSourceIds\("statusBindings"/);
  assert.match(settings, /"statusBindingsCompendium"[\s\S]*?config: false/);
  assert.match(settings, /worldStatuses\.bindingsMigrated/);
  assert.match(settings, /retireLegacyStatusBindingSources/);
  assert.match(settings, /configuredSources\.statusBindings = \[\]/);
});

test("retired bundled sources are removed without discarding user libraries", () => {
  const settings = fs.readFileSync("module/settings.js", "utf8");
  const main = fs.readFileSync("scripts/main.js", "utf8");

  for (const sourceId of ["gum.conditions", "gum.modifiers", "gum.templates", "gum.eqp_modifiers", "gum.gm_modifiers", "gum.skills", "gum.regras", "gum.efeitos", "gum.gatilhos"]) {
    assert.match(settings, new RegExp(sourceId.replace(".", "\\.")));
  }
  assert.match(settings, /contentSourcesRetiredBundledSourcesMigrationV2/);
  assert.match(settings, /filter\(id => id !== retiredId\)/);
  assert.match(main, /await migrateRetiredBundledSources\(\)/);
});
