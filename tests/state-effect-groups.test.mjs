import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  buildExclusiveGroupUpdates,
  getStateEffectGroups,
  isManualStateEffectMode,
  isStateEffectGroupDesired,
  normalizeStateEffectGroup
} from "../module/utils/state-effect-groups.mjs";

test("normalizes state effect groups without mutating their linked effects", () => {
  const effects = { link: { effectUuid: "Item.effect" } };
  const group = normalizeStateEffectGroup("wolf", { name: " Forma Lupina ", mode: "invalid", effects });
  assert.equal(group.id, "wolf");
  assert.equal(group.name, "Forma Lupina");
  assert.equal(group.mode, "manual");
  assert.equal(group.effects, effects);
});

test("resolves every supported automatic and compound mode", () => {
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "present" }, {}), true);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "equipped" }, { equipped: true }), true);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "equipped" }, { location: "carried" }), false);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "carried" }, { location: "equipped" }), true);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "carried" }, { stored: true, location: "stored" }), false);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "manual", active: true }, {}), true);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "equipped_manual", active: true }, { equipped: false }), false);
  assert.equal(isStateEffectGroupDesired({ id: "a", mode: "equipped_manual", active: true }, { equipped: true }), true);
});

test("identifies modes that expose a manual toggle", () => {
  assert.equal(isManualStateEffectMode("manual"), true);
  assert.equal(isManualStateEffectMode("equipped_manual"), true);
  assert.equal(isManualStateEffectMode("equipped"), false);
});

test("deactivates only active peers from the same exclusive set", () => {
  const groups = getStateEffectGroups({ stateEffectGroups: {
    wolf: { active: false, exclusiveSet: "forms" },
    bear: { active: true, exclusiveSet: "forms" },
    aura: { active: true, exclusiveSet: "auras" }
  }});
  assert.deepEqual(buildExclusiveGroupUpdates(groups, "wolf"), {
    "system.stateEffectGroups.bear.active": false
  });
});

test("exclusive set names are matched without case or surrounding spaces", () => {
  const groups = getStateEffectGroups({ stateEffectGroups: {
    wolf: { active: false, exclusiveSet: " Formas " },
    bear: { active: true, exclusiveSet: "formas" }
  }});
  assert.deepEqual(buildExclusiveGroupUpdates(groups, "wolf"), {
    "system.stateEffectGroups.bear.active": false
  });
});

test("wires state groups through the item model, sheets and lifecycle hooks", async () => {
  const [model, itemTemplate, actorSheet, actorStyles, main, engine, service] = await Promise.all([
    readFile(new URL("../template.json", import.meta.url), "utf8"),
    readFile(new URL("../templates/items/item-sheet.hbs", import.meta.url), "utf8"),
    readFile(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8"),
    readFile(new URL("../styles/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/main.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/effects-engine.js", import.meta.url), "utf8"),
    readFile(new URL("../module/services/state-effect-service.js", import.meta.url), "utf8")
  ]);
  assert.ok(JSON.parse(model).Item.templates.base.stateEffectGroups);
  assert.match(itemTemplate, /data-state-group-id/);
  assert.match(itemTemplate, /equipped_manual/);
  assert.match(actorSheet, /item-toggle-state-effect-group/);
  assert.match(actorSheet, /state-effect-automation__trigger/);
  assert.match(actorSheet, /groups\.length <= 2/);
  assert.match(actorSheet, /\.prop\('disabled', !manual\)/);
  assert.match(actorStyles, /characteristic-card \.item-controls \{[\s\S]*flex: 1 0 calc\(100% - 40px\)/);
  assert.match(actorStyles, /characteristic-card \.item-controls \.state-effect-automation \{ margin-right: auto; \}/);
  assert.match(main, /syncItemStateEffects\(item/);
  assert.match(engine, /stateEffectActivationId/);
  assert.match(engine, /context\.skipInstantEffects/);
  assert.match(actorSheet, /await game\.gum\.syncItemStateEffects\(item\)/);
  assert.match(main, /Hooks\.once\("ready"[\s\S]+reconcileAllStateEffects/);
  assert.match(service, /syncQueues/);
  assert.match(service, /activationId/);
  assert.match(service, /Ações persistentes não criadas/);
  assert.doesNotMatch(actorSheet, /group\.runtimeActive === true/);
});