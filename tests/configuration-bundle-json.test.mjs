import test from "node:test";
import assert from "node:assert/strict";

import {
  buildConfigurationBundle,
  parseConfigurationBundle,
  prepareConfigurationBundle
} from "../module/utils/configuration-bundle-json.mjs";

const effect = name => ({ name, type: "effect", system: { schemaVersion: 2, actions: [] } });

test("recognizes configuration bundles and validates kinds and document types", () => {
  assert.equal(parseConfigurationBundle({ format: "another-format" }), null);
  assert.throws(() => parseConfigurationBundle({ format: "gum-configuration-bundle", version: 2 }), /Unsupported/);
  assert.throws(() => parseConfigurationBundle({
    format: "gum-configuration-bundle", version: 1, id: "x", kind: "unknown", configuration: {}
  }), /kind/);
  assert.throws(() => parseConfigurationBundle({
    format: "gum-configuration-bundle", version: 1, id: "statuses", kind: "world-statuses",
    configuration: {}, documents: { modifier: { name: "No", type: "gm_modifier", system: {} } }
  }), /does not support/);
});

test("resolves shared GM Screen item references to one stable compendium UUID", () => {
  const bundle = {
    format: "gum-configuration-bundle", version: 1, id: "gm-screen-test", name: "GM Screen", kind: "gm-screen",
    configuration: { tabs: [{ id: "main", groups: [
      { id: "a", items: [{ itemRef: "glow" }] },
      { id: "b", items: [{ itemRef: "glow" }, { itemRef: "penalty" }] }
    ] }] },
    documents: {
      glow: effect("Glow"),
      penalty: { name: "Darkness", type: "gm_modifier", system: { modifier: -2 } }
    }
  };
  const prepared = prepareConfigurationBundle(bundle, "world.screen");
  const first = prepared.configuration.tabs[0].groups[0].items[0];
  const shared = prepared.configuration.tabs[0].groups[1].items[0];
  assert.equal(first, shared);
  assert.match(first, /^Compendium\.world\.screen\.Item\.[A-Za-z0-9]{16}$/);
  assert.equal(prepared.itemBundle.documents.glow.type, "effect");
});

test("resolves status effectRefs while preserving external UUIDs", () => {
  const bundle = {
    format: "gum-configuration-bundle", version: 1, id: "statuses-test", kind: "world-statuses",
    configuration: {
      bindingsMigrated: true,
      overrides: { stunned: { effectUuids: [{ effectRef: "glow" }, "Item.external"] } },
      customStatuses: [{ id: "blessed", effectRefs: ["glow"] }]
    },
    documents: { glow: effect("Glow") }
  };
  const prepared = prepareConfigurationBundle(bundle, "world.statuses");
  const localUuid = prepared.configuration.overrides.stunned.effectUuids[0];
  assert.equal(prepared.configuration.overrides.stunned.effectUuids[1], "Item.external");
  assert.deepEqual(prepared.configuration.customStatuses[0].effectUuids, [localUuid]);
  assert.equal("effectRefs" in prepared.configuration.customStatuses[0], false);
});

test("rejects missing or misplaced local configuration references", () => {
  const missing = {
    format: "gum-configuration-bundle", version: 1, id: "x", kind: "gm-screen",
    configuration: { groups: [{ items: [{ itemRef: "missing" }] }] }, documents: {}
  };
  assert.throws(() => prepareConfigurationBundle(missing), /Unknown configuration bundle reference/);

  const misplaced = {
    format: "gum-configuration-bundle", version: 1, id: "x", kind: "world-statuses",
    configuration: { unexpected: { effectRef: "glow" } }, documents: { glow: effect("Glow") }
  };
  assert.throws(() => prepareConfigurationBundle(misplaced, "world.statuses"), /not allowed/);
});

test("exports referenced documents once and keeps missing external references", async () => {
  const documents = new Map([["Item.glow", {
    id: "glow", name: "Glow", type: "effect", folder: "folder", system: { actions: [] },
    toObject() { return { _id: this.id, name: this.name, type: this.type, folder: this.folder, system: this.system }; }
  }]]);
  const bundle = await buildConfigurationBundle({
    id: "export-test", kind: "gm-screen",
    configuration: { groups: [{ items: ["Item.glow", "Item.glow", "Item.missing"] }] },
    resolveUuid: uuid => documents.get(uuid) || null
  });
  assert.equal(Object.keys(bundle.documents).length, 1);
  assert.deepEqual(bundle.configuration.groups[0].items.slice(0, 2), [
    { itemRef: "effect-glow" }, { itemRef: "effect-glow" }
  ]);
  assert.equal(bundle.configuration.groups[0].items[2], "Item.missing");
  assert.equal(bundle.documents["effect-glow"]._id, undefined);
  assert.equal(bundle.documents["effect-glow"].folder, undefined);
});

test("exports effects linked indirectly by a GM modifier", async () => {
  const documents = new Map([
    ["Item.modifier", {
      id: "modifier", name: "Fog", type: "gm_modifier",
      system: { passiveEffects: { aura: { id: "aura", effectUuid: "Item.effect" } } }
    }],
    ["Item.effect", { id: "effect", name: "Obscured", type: "effect", system: { actions: [] } }]
  ]);
  const bundle = await buildConfigurationBundle({
    id: "nested-export", kind: "gm-screen",
    configuration: { groups: [{ items: ["Item.modifier"] }] },
    resolveUuid: uuid => documents.get(uuid) || null
  });

  assert.deepEqual(Object.keys(bundle.documents).sort(), ["effect-effect", "gm_modifier-modifier"]);
  assert.equal(
    bundle.documents["gm_modifier-modifier"].system.passiveEffects.aura.effectRef,
    "effect-effect"
  );
  assert.equal(bundle.documents["gm_modifier-modifier"].system.passiveEffects.aura.effectUuid, undefined);
  const prepared = prepareConfigurationBundle(bundle, "world.gm-screen");
  assert.match(
    prepared.preparedItems.documents.find(entry => entry.key === "gm_modifier-modifier")
      .data.system.passiveEffects.aura.effectUuid,
    /^Compendium\.world\.gm-screen\.Item\./
  );
});
