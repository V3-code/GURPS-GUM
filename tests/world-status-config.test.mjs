import assert from "node:assert/strict";
import test from "node:test";
import {
  activeEffectHasStatus,
  applyWorldStatusConfiguration,
  buildWorldStatusBindingRules,
  buildWorldStatusCleanupPlan,
  buildWorldStatusPresentationPlan,
  buildWorldStatusConfiguration,
  collectWorldStatusActors,
  collectInvalidWorldStatusReferences,
  collectWorldStatusDependencies,
  getItemStatusReferences,
  itemReferencesStatus,
  normalizeWorldStatusConfiguration,
  resolveWorldStatusRows
} from "../module/utils/world-status-config.mjs";

const base = [
  { id: "stunned", name: "Stunned", img: "stunned.png" },
  { id: "prone", name: "Prone", img: "prone.png" }
];

test("world overrides customize, order, remove, and add statuses without mutating defaults", () => {
  const configuration = normalizeWorldStatusConfiguration({
    disabledStatusIds: ["prone"],
    overrides: { stunned: { name: "Dazed", img: "dazed.svg", effectUuids: ["Item.effect"] } },
    customStatuses: [{ id: "blessed", name: "Blessed", img: "blessed.svg" }],
    order: ["blessed", "stunned"]
  });
  const rows = resolveWorldStatusRows(base, configuration);

  assert.deepEqual(rows.map(row => row.id), ["blessed", "stunned"]);
  assert.equal(rows[1].name, "Dazed");
  assert.deepEqual(rows[1].effectUuids, ["Item.effect"]);
  assert.equal(base[0].name, "Stunned");
});

test("saving rows keeps system differences compact and records removed defaults", () => {
  const configuration = buildWorldStatusConfiguration(base, [
    { ...base[0], effectUuids: ["Item.effect"], stackMode: "stack", stackLimit: 3, removeOnStatusOff: false },
    { id: "blessed", name: "Blessed", img: "blessed.svg", effectUuids: [], custom: true }
  ]);

  assert.deepEqual(configuration.disabledStatusIds, ["prone"]);
  assert.deepEqual(configuration.overrides.stunned.effectUuids, ["Item.effect"]);
  assert.equal(configuration.overrides.stunned.stackMode, "stack");
  assert.equal(configuration.overrides.stunned.stackLimit, 3);
  assert.equal(configuration.overrides.stunned.removeOnStatusOff, false);
  assert.equal(configuration.customStatuses[0].id, "blessed");
  assert.equal(configuration.bindingsMigrated, true);
});

test("world status effects become Foundry statuses and automation rules", () => {
  const target = {};
  const rows = applyWorldStatusConfiguration(base, {
    bindingsMigrated: true,
    overrides: { stunned: { effectUuids: ["Compendium.world.effects.Item.a"], legacyRuleUuids: ["Compendium.world.rules.Item.old"] } }
  }, { target, localize: value => value });
  const rules = buildWorldStatusBindingRules(rows);

  assert.deepEqual(target.statusEffects.map(status => status.id), ["stunned", "prone"]);
  assert.deepEqual(target.statusEffects.map(status => status.order), [0, 1]);
  assert.equal(target.statusEffects[0].icon, "stunned.png");
  assert.equal(rules.length, 1);
  assert.equal(rules[0].system.statusBinding.statusId, "stunned");
  assert.deepEqual(rules[0].system.effects, [{ uuid: "Compendium.world.effects.Item.a" }]);
  assert.deepEqual(rules[0].legacyRuleUuids, ["Compendium.world.rules.Item.old"]);
});

test("status dependency inspection finds active effects, item actions, and legacy rules", () => {
  const activeEffect = { id: "active", statuses: new Set(["stunned"]) };
  const actor = { id: "actor", effects: [activeEffect] };
  const directItem = { id: "direct", system: { attachedStatusId: "stunned" } };
  const actionItem = { id: "action", system: { actions: [{ type: "status", statusId: "stunned" }] } };
  const unrelatedItem = { id: "other", system: { actions: [{ statusId: "prone" }] } };
  const rule = { id: "rule", system: { statusBinding: { statusId: "stunned" } } };

  assert.equal(activeEffectHasStatus(activeEffect, "stunned"), true);
  assert.equal(itemReferencesStatus(actionItem, "stunned"), true);
  const dependencies = collectWorldStatusDependencies("stunned", {
    actors: [actor],
    items: [directItem, actionItem, unrelatedItem],
    bindingRules: [rule]
  });

  assert.equal(dependencies.activeEffects.length, 1);
  assert.deepEqual(dependencies.referencingItems.map(item => item.id), ["direct", "action"]);
  assert.deepEqual(dependencies.referencingRules.map(item => item.id), ["rule"]);
});

test("cleanup removes generated or inert status effects and preserves mechanical effects", () => {
  const actor = {
    effects: [
      { id: "inert", statuses: new Set(["stunned"]), changes: [] },
      {
        id: "generated",
        statuses: new Set(["stunned"]),
        changes: [{ key: "system.hp", value: -1 }],
        flags: { gum: { source: "statusBinding", statusBindingStatusId: "stunned" } }
      },
      {
        id: "mechanical",
        statuses: new Set(["stunned", "prone"]),
        changes: [{ key: "system.move", value: -1 }],
        flags: { core: { statusId: "stunned" } }
      }
    ]
  };

  const plan = buildWorldStatusCleanupPlan(actor, "stunned");
  assert.deepEqual(plan.deletes, ["inert", "generated"]);
  assert.deepEqual(plan.updates, [{
    _id: "mechanical",
    statuses: ["prone"],
    "flags.core.-=statusId": null
  }]);
});

test("invalid-reference review identifies stale statuses without changing documents", () => {
  const effect = { id: "effect", statuses: new Set(["removed", "stunned"]), flags: { core: { statusId: "removed" } } };
  const actor = { id: "actor", effects: [effect] };
  const item = {
    id: "item",
    system: { attachedStatusId: "removed", actions: [{ statusId: "stunned" }, { statusId: "missing" }] }
  };
  const rule = { id: "rule", system: { statusBinding: { statusId: "removed" } } };

  assert.deepEqual(getItemStatusReferences(item), [
    { statusId: "removed", path: "system.attachedStatusId" },
    { statusId: "stunned", path: "system.actions.0.statusId" },
    { statusId: "missing", path: "system.actions.1.statusId" }
  ]);
  const report = collectInvalidWorldStatusReferences(["stunned"], {
    actors: [actor],
    items: [item],
    bindingRules: [rule]
  });
  assert.deepEqual(report.activeEffects[0].statusIds, ["removed"]);
  assert.deepEqual(report.itemReferences[0].references.map(reference => reference.statusId), ["removed", "missing"]);
  assert.equal(report.legacyRules[0].statusId, "removed");
  assert.equal(item.system.attachedStatusId, "removed");
});

test("runtime actor collection includes world and unlinked token actors without duplicates", () => {
  const worldActor = { id: "world", uuid: "Actor.world" };
  const tokenActor = { id: "token", uuid: "Scene.scene.Token.token.Actor.token" };
  const actors = collectWorldStatusActors({
    worldActors: [worldActor],
    scenes: [{ tokens: [{ actor: worldActor }, { actor: tokenActor }] }],
    canvasTokens: [{ actor: tokenActor }]
  });
  assert.deepEqual(actors, [worldActor, tokenActor]);
});

test("presentation reconciliation updates native status icons while preserving mechanical effects", () => {
  const native = { id: "native", name: "Old", img: "old.png", statuses: new Set(["stunned"]), changes: [] };
  const mechanical = {
    id: "mechanical",
    name: "Mechanical",
    img: "mechanical.png",
    statuses: new Set(["stunned"]),
    changes: [{ key: "system.move", value: -1 }]
  };
  const automation = {
    id: "automation",
    name: "Automation",
    img: "automation.png",
    statuses: new Set(["stunned"]),
    changes: [],
    flags: { gum: { effectUuid: "Item.effect" } }
  };
  const actor = { effects: [native, mechanical, automation] };
  const plan = buildWorldStatusPresentationPlan([actor], [{
    id: "stunned",
    name: "Dazed",
    img: "new.png",
    nameCustomized: true
  }]);
  assert.deepEqual(plan, [{ actor, updates: [{ _id: "native", name: "Dazed", img: "new.png" }] }]);
});

test("presentation reconciliation does not persist a client's localization over a default status name", () => {
  const effect = { id: "native", name: "Atordoado", img: "old.png", statuses: new Set(["stunned"]), changes: [] };
  const actor = { effects: [effect] };
  const plan = buildWorldStatusPresentationPlan([actor], [{ id: "stunned", name: "Stunned", img: "new.png" }]);
  assert.deepEqual(plan, [{ actor, updates: [{ _id: "native", img: "new.png" }] }]);
});
