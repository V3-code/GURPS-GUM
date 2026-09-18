import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildPassiveConditionSyncOperations } from "../module/utils/passive-condition-sync.mjs";

test("actor creation and synchronization use configured passive condition sources", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(main, /contentSourceService\.getDocuments\("passiveConditions"\)/);
  assert.match(settings, /contentSourceService\.getDocuments\("passiveConditions"\)/);
  assert.doesNotMatch(main, /game\.packs\.get\("gum\.regras"\)/);
  assert.doesNotMatch(settings, /game\.packs\.get\("gum\.Regras"\)/);
});

test("passive condition copies retain their exact source UUID", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(main, /normalizeItemForV13\(item\.toObject\(\), item\.uuid\)/);
  assert.match(settings, /buildPassiveConditionSyncOperations\(actor\.items, passiveRules\)/);
});

test("synchronization updates existing passive conditions and adds newly configured ones", () => {
  const existingSource = {
    uuid: "Compendium.gum.regras.Item.existing",
    system: { value: 2 },
    toObject: () => ({ name: "Atualizada", type: "condition", img: "updated.webp", system: { value: 2 } })
  };
  const newSource = {
    uuid: "Compendium.world.rules.Item.new",
    system: { value: 1 },
    toObject: () => ({ _id: "pack-id", name: "Nova", type: "condition", img: "new.webp", system: { value: 1 } })
  };
  const statusBinding = {
    uuid: "Compendium.gum.regras.Item.status",
    system: { bindingMode: "status-link" },
    toObject: () => ({ name: "Não copiar", type: "condition", system: {} })
  };
  const actorItems = [{
    id: "actor-existing",
    _stats: { compendiumSource: existingSource.uuid }
  }];

  const result = buildPassiveConditionSyncOperations(actorItems, [existingSource, newSource, statusBinding]);

  assert.deepEqual(result.updates, [{
    _id: "actor-existing",
    name: "Atualizada",
    system: { value: 2 },
    img: "updated.webp"
  }]);
  assert.equal(result.creates.length, 1);
  assert.equal(result.creates[0]._id, undefined);
  assert.equal(result.creates[0]._stats.compendiumSource, newSource.uuid);
});
