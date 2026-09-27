import test from "node:test";
import assert from "node:assert/strict";
import {
  collectEquipmentModifierActionsFromForm,
  equipmentCapabilities,
  matchesEquipmentRequirements,
  normalizeEquipmentModifierActions,
  parseEquipmentAdjustment,
  prepareEquipment,
  registerEquipmentModifierProperty
} from "../module/services/equipment-modifier-engine.mjs";

const equipment = (overrides = {}) => ({
  cost: 100,
  weight: 10,
  material: "Madeira",
  defense_bonus: 1,
  melee_attacks: { bash: { mode: "Golpe", damage_formula: "1d", damage_type: "cont", skill_level_mod: 0, armor_divisor: 1 } },
  ranged_attacks: { shot: { mode: "Disparo", damage_formula: "1d", damage_type: "perf", skill_level_mod: 0 } },
  eqp_modifiers: {},
  ...overrides
});

test("parses every supported legacy price and weight expression", () => {
  assert.deepEqual(parseEquipmentAdjustment("+0,5 CF", { allowCF: true }), { operation: "cost_factor", value: 0.5, label: "+0.5 CF", valid: true });
  assert.equal(parseEquipmentAdjustment("-10%").operation, "percent");
  assert.equal(parseEquipmentAdjustment("x1.5").operation, "multiply");
  assert.equal(parseEquipmentAdjustment("+25").operation, "add");
  assert.equal(parseEquipmentAdjustment("n/a").valid, false);
});

test("normalizes Foundry form objects back into ordered action arrays", () => {
  const actions = normalizeEquipmentModifierActions({
    1: { id: "second", type: "pricing" },
    0: { id: "first", type: "equipment_property" }
  });
  assert.deepEqual(actions.map(action => action.id), ["first", "second"]);
  actions[0].id = "changed";
  assert.equal(normalizeEquipmentModifierActions({ 0: { id: "first" } })[0].id, "first");
});

test("collects flattened Foundry action fields without losing nested selectors", () => {
  const result = collectEquipmentModifierActionsFromForm({
    "system.actions.1.id": "second",
    "system.actions.1.type": "pricing",
    "system.actions.0.id": "first",
    "system.actions.0.type": "attack_property",
    "system.actions.0.selector.mode": "melee",
    unrelated: true
  });
  assert.deepEqual(result.actions.map(action => action.id), ["first", "second"]);
  assert.equal(result.actions[0].selector.mode, "melee");
  assert.equal(result.actions[1].property, "cost");
  assert.equal(result.keys.length, 5);
});

test("central calculation combines CF, percentages, multipliers and fixed values in stages", () => {
  const modifiers = {
    a: { id: "a", name: "CF", cost_adjustment: "+0.5 CF", weight_mod: "-10%" },
    b: { id: "b", name: "Mixed", actions: [
      { id: "cf", type: "pricing", property: "cost", operation: "cost_factor", value: 0.5 },
      { id: "pct", type: "pricing", property: "cost", operation: "percent", value: -10 },
      { id: "mul", type: "pricing", property: "cost", operation: "multiply", value: 2 },
      { id: "flat", type: "pricing", property: "cost", operation: "add", value: 20 },
      { id: "weight", type: "pricing", property: "weight", operation: "add", value: 2 }
    ] }
  };
  const result = prepareEquipment(equipment(), modifiers);
  assert.equal(result.system.effectiveCost, 380); // 100 × (1 + 1 CF) × .9 × 2 + 20
  assert.equal(result.system.effectiveWeight, 11); // 10 × .9 + 2
  assert.equal(result.calculation.cost.baseValue, 100);
  assert.equal(result.calculation.cost.steps.length, 4);
});

test("legacy values remain active beside unrelated explicit actions", () => {
  const result = prepareEquipment(equipment(), [{
    id: "spike", cost_adjustment: "+0.2 CF", weight_mod: "x1.1",
    actions: [{ id: "type", type: "attack_property", selector: { mode: "melee" }, property: "damage_type", operation: "override", value: "perf" }]
  }]);
  assert.equal(result.system.effectiveCost, 120);
  assert.equal(result.system.effectiveWeight, 11);
  assert.equal(result.system.melee_attacks.bash.damage_type, "perf");
});

test("legacy cost_factor survives a default zero cost_adjustment", () => {
  const result = prepareEquipment(equipment(), [{ id: "old", cost_adjustment: "0 CF", cost_factor: 0.5, weight_mod: "x1" }]);
  assert.equal(result.system.effectiveCost, 150);
});

test("attack selectors affect all, melee, ranged or stable ids", () => {
  const result = prepareEquipment(equipment(), [{ id: "m", actions: [
    { id: "melee", type: "attack_property", selector: { mode: "melee" }, property: "skill_level_mod", operation: "add", value: 1 },
    { id: "specific", type: "attack_property", selector: { mode: "ids", ids: ["shot"] }, property: "damage_formula", operation: "override", value: "2d" }
  ] }]);
  assert.equal(result.system.melee_attacks.bash.skill_level_mod, 1);
  assert.equal(result.system.ranged_attacks.shot.skill_level_mod, 0);
  assert.equal(result.system.ranged_attacks.shot.damage_formula, "2d");
  assert.equal(equipment().melee_attacks.bash.skill_level_mod, 0, "base data is not mutated");
});

test("number-text arithmetic preserves combat and technology suffixes", () => {
  const result = prepareEquipment(equipment({ tech_level: "8^", melee_attacks: { bash: { parry: "0U" } } }), [{ id: "suffixes", actions: [
    { id: "tl", type: "equipment_property", property: "tech_level", operation: "add", value: 1 },
    { id: "parry", type: "attack_property", selector: { mode: "melee" }, property: "parry", operation: "add", value: 1 }
  ] }]);
  assert.equal(result.system.tech_level, "9^");
  assert.equal(result.system.melee_attacks.bash.parry, "1U");
});

test("created attack ids are deterministic and preparation is idempotent", () => {
  const modifier = { id: "spike", actions: [{ id: "new-mode", type: "attack_create", attack_type: "melee", attack: { mode: "Espinhos", damage_formula: "1d+1", damage_type: "perf" } }] };
  const first = prepareEquipment(equipment(), [modifier]);
  const second = prepareEquipment(equipment(), [modifier]);
  assert.deepEqual(Object.keys(first.system.melee_attacks), Object.keys(second.system.melee_attacks));
  assert.equal(first.system.melee_attacks["eqpm-spike-new-mode"].damage_type, "perf");
});

test("requirements expose functional capabilities and skip incompatible modifiers", () => {
  const system = equipment();
  assert.deepEqual(equipmentCapabilities(system), { has_melee_attack: true, has_ranged_attack: true, has_attack: true, has_defense_bonus: true, has_dr: false, is_container: false });
  assert.equal(matchesEquipmentRequirements(system, { all: ["has_melee_attack"], none: ["has_dr"] }), true);
  const result = prepareEquipment(system, [{ id: "armor-only", name: "Armadura", requirements: { all: ["has_dr"] }, actions: [{ id: "material", type: "equipment_property", property: "material", operation: "override", value: "Aço" }] }]);
  assert.equal(result.system.material, "Madeira");
  assert.equal(result.warnings.length, 1);
});

test("calculation records provenance and unsupported actions instead of corrupting data", () => {
  const result = prepareEquipment(equipment(), [{ id: "bad", name: "Inválido", actions: [
    { id: "unknown-field", type: "equipment_property", property: "__proto__", operation: "override", value: "x" },
    { id: "missing", label: "Ataque ausente", type: "attack_property", selector: { mode: "ids", ids: ["absent"] }, property: "damage_type", operation: "override", value: "perf" }
  ] }]);
  assert.equal(result.skippedActions.length, 2);
  assert.match(result.warnings[0], /não encontrou ataques/);
  assert.equal(Object.getPrototypeOf(result.system), Object.prototype);
});

test("modifier effect links are namespaced and contributed to the prepared equipment", () => {
  const result = prepareEquipment(equipment({ onDamageEffects: { base: { uuid: "Item.base" } } }), [{
    id: "flaming",
    onDamageEffects: { fire: { uuid: "Item.fire", recipient: "target" } },
    activationEffects: { success: { light: { uuid: "Item.light", recipient: "self" } }, failure: {} }
  }]);
  assert.equal(result.system.onDamageEffects.base.uuid, "Item.base");
  assert.equal(result.system.onDamageEffects["eqpm-flaming-fire"].uuid, "Item.fire");
  assert.equal(result.system.activationEffects.success["eqpm-flaming-light"].recipient, "self");
});

test("modules can register validated future equipment properties", () => {
  registerEquipmentModifierProperty("decoration", { path: "decoration", kind: "text", operations: ["override", "append"] });
  const result = prepareEquipment(equipment({ decoration: "Prata" }), [{ id: "ornate", actions: [{ id: "gems", type: "equipment_property", property: "decoration", operation: "append", value: " e rubis" }] }]);
  assert.equal(result.system.decoration, "Prata e rubis");
  assert.throws(() => registerEquipmentModifierProperty("unsafe", { path: "__proto__.polluted", operations: ["override"] }), /inválido/);
});
