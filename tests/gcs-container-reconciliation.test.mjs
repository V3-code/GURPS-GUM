import test from "node:test";
import assert from "node:assert/strict";
import { prepareGCSActorItemChanges } from "../module/utils/gcs-container-reconciliation.mjs";

const item = (id, name, parent = "") => ({
  _id: id,
  name,
  type: "equipment",
  system: { parent_container_id: parent }
});

test("preserva IDs reservados e vínculos ao adicionar uma árvore de contêineres", () => {
  const plan = {
    additions: [item("temp-parent", "Mochila"), item("temp-child", "Corda", "temp-parent")],
    updates: [], unchanged: [], removals: []
  };
  let id = 0;
  const result = prepareGCSActorItemChanges(plan, {
    additions: new Set([1]), updates: new Set(), removals: new Set()
  }, { randomID: () => `final-${++id}` });

  assert.equal(result.additions.length, 2, "selecionar o filho também inclui o contêiner necessário");
  assert.equal(result.additions[0]._id, "final-1");
  assert.equal(result.additions[1].system.parent_container_id, "final-1");
});

test("remapeia filhos novos para o ID real de um contêiner existente", () => {
  const plan = {
    additions: [item("temp-child", "Corda", "temp-parent")],
    updates: [],
    unchanged: [{ existing: item("existing-parent", "Mochila"), incoming: item("temp-parent", "Mochila") }],
    removals: []
  };
  const result = prepareGCSActorItemChanges(plan, {
    additions: new Set([0]), updates: new Set(), removals: new Set()
  }, { randomID: () => "final-child" });

  assert.equal(result.additions[0].system.parent_container_id, "existing-parent");
});

test("remapeia o pai ao atualizar um item incorporado", () => {
  const plan = {
    additions: [],
    updates: [
      { existing: item("existing-parent", "Mochila"), incoming: item("temp-parent", "Mochila") },
      { existing: item("existing-child", "Corda"), incoming: item("temp-child", "Corda", "temp-parent") }
    ],
    unchanged: [], removals: []
  };
  const result = prepareGCSActorItemChanges(plan, {
    additions: new Set(), updates: new Set([0, 1]), removals: new Set()
  }, { randomID: () => "unused" });

  assert.equal(result.updates[1]._id, "existing-child");
  assert.equal(result.updates[1].system.parent_container_id, "existing-parent");
});

test("substitui modos de ataque importados em vez de acumulá-los", () => {
  const existing = {
    ...item("existing-sword", "Espada"),
    system: {
      melee_attacks: { "old-slash": { mode: "Corte" } },
      ranged_attacks: { "old-throw": { mode: "Arremesso" } }
    }
  };
  const incoming = {
    ...item("temporary-sword", "Espada"),
    system: {
      melee_attacks: { "new-slash": { mode: "Corte", damage_formula: "1d6+2" } },
      ranged_attacks: {}
    }
  };
  const plan = { additions: [], updates: [{ existing, incoming }], unchanged: [], removals: [] };

  const result = prepareGCSActorItemChanges(plan, {
    additions: new Set(), updates: new Set([0]), removals: new Set()
  }, { randomID: () => "unused" });

  const [update] = result.updates;
  assert.equal(update._id, "existing-sword");
  assert.deepEqual(update.system.melee_attacks, incoming.system.melee_attacks);
  assert.deepEqual(update.system.ranged_attacks, {});
  assert.equal(update["system.melee_attacks.-=old-slash"], null);
  assert.equal(update["system.ranged_attacks.-=old-throw"], null);
});
