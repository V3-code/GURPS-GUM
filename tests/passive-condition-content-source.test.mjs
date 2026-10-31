import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildPassiveConditionConfigEntry,
  buildPassiveConditionSyncOperations,
  normalizePassiveConditionConfiguration,
  resolvePassiveConditionConfiguration,
  summarizePassiveConditionSync
} from "../module/utils/passive-condition-sync.mjs";

test("actor creation and synchronization use configured passive condition sources", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(main, /contentSourceService\.getDocuments\("passiveConditions"\)/);
  assert.match(settings, /contentSourceService\.getDocuments\("passiveConditions"\)/);
  assert.doesNotMatch(main, /game\.packs\.get\("gum\.regras"\)/);
  assert.doesNotMatch(settings, /game\.packs\.get\("gum\.Regras"\)/);
});

test("world settings expose the dedicated passive-condition manager", () => {
  const settings = fs.readFileSync("module/settings.js", "utf8");
  const app = fs.readFileSync("module/apps/passive-condition-config.js", "utf8");
  const template = fs.readFileSync("templates/apps/passive-condition-config.hbs", "utf8");
  assert.match(settings, /registerMenu\("gum", "passiveConditionConfig"/);
  assert.match(app, /purpose: "passiveConditions"/);
  assert.match(app, /removeMissing: true/);
  assert.match(template, /passive-condition-dropzone/);
  assert.match(template, /data-action="sync"/);
});

test("passive condition copies retain their exact source UUID", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(main, /preparePassiveConditionCreateData\(item, record\)/);
  assert.match(main, /record\.sourceUuid \|\| item\.uuid/);
  assert.match(settings, /buildPassiveConditionSyncOperations\(actor\.items, passiveRules, options\)/);
});

test("synchronization updates existing passive conditions and adds newly configured ones", () => {
  const existingSource = {
    uuid: "Compendium.world.passive.Item.existing",
    system: { value: 2 },
    toObject: () => ({ name: "Atualizada", type: "condition", img: "updated.webp", system: { value: 2 } })
  };
  const newSource = {
    uuid: "Compendium.world.rules.Item.new",
    system: { value: 1 },
    toObject: () => ({ _id: "pack-id", name: "Nova", type: "condition", img: "new.webp", system: { value: 1 } })
  };
  const statusBinding = {
    uuid: "Compendium.world.passive.Item.status",
    system: { bindingMode: "status-link" },
    toObject: () => ({ name: "Não copiar", type: "condition", system: {} })
  };
  const actorItems = [{
    id: "actor-existing",
    _stats: { compendiumSource: existingSource.uuid }
  }];

  const result = buildPassiveConditionSyncOperations(actorItems, [existingSource, newSource, statusBinding]);

  assert.equal(result.updates[0]._id, "actor-existing");
  assert.equal(result.updates[0].name, "Atualizada");
  assert.equal(result.updates[0]["flags.gum.passiveConditionManaged"], true);
  assert.equal(result.creates.length, 1);
  assert.equal(result.creates[0]._id, undefined);
  assert.equal(result.creates[0]._stats.compendiumSource, newSource.uuid);
  assert.deepEqual(result.deletes, []);
});

test("authoritative synchronization removes only conditions previously managed by the configuration", () => {
  const managed = { id: "managed", type: "condition", flags: { gum: { passiveConditionManaged: true, passiveConditionConfigId: "old" } } };
  const manual = { id: "manual", type: "condition", flags: {} };
  const unrelated = { id: "skill", type: "skill", flags: { gum: { passiveConditionManaged: true } } };
  const result = buildPassiveConditionSyncOperations([managed, manual, unrelated], [], { removeMissing: true });
  assert.deepEqual(result.deletes, ["managed"]);
});

test("world configuration stores a portable snapshot and resolves it when its source is unavailable", async () => {
  const source = { uuid: "Compendium.world.rules.Item.collapse", name: "Colapso", img: "collapse.svg", type: "condition", system: { when: "hp <= 0", effects: [{ uuid: "Item.effect" }] }, toObject() { return { _id: "source", name: this.name, img: this.img, type: this.type, system: this.system }; } };
  const entry = buildPassiveConditionConfigEntry(source);
  const config = normalizePassiveConditionConfiguration({ initialized: true, entries: [entry, entry] });
  assert.equal(config.entries.length, 1);
  assert.equal(config.entries[0].snapshot._id, undefined);
  const resolution = await resolvePassiveConditionConfiguration(config, { resolveUuid: async () => null });
  assert.equal(resolution.resolved.length, 1);
  assert.equal(resolution.resolved[0].document.toObject().name, "Colapso");
});

test("synchronization preview totals creates, updates, and safe removals", () => {
  const source = { document: { uuid: "Item.new", type: "condition", system: {}, toObject: () => ({ name: "Nova", type: "condition", system: {} }) }, configId: "new", sourceUuid: "Item.new" };
  const actors = [{ items: [] }, { items: [{ id: "old", type: "condition", flags: { gum: { passiveConditionManaged: true, passiveConditionConfigId: "old" } } }] }];
  assert.deepEqual(summarizePassiveConditionSync(actors, [source], { removeMissing: true }), { actors: 2, creates: 2, updates: 0, deletes: 1 });
});
