import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeEquipmentModifier,
  parseEquipmentAdjustment,
  resolveEquipment
} from "../module/utils/equipment-resolution.mjs";

const modifier = ({ name, cost, costStage = "base", weight = "x1", weightStage = "base", level = 1, perLevel = false, perWeight = false } = {}) => ({
  name,
  level,
  cost_adjustment_data: { expression: cost ?? "0 CF", stage: costStage, per_level: perLevel, per_weight: perWeight, per_weight_unit: "kg" },
  weight_adjustment_data: { expression: weight, stage: weightStage, per_level: perLevel }
});

test("parses CF, percentages, multipliers, fractions and weight units", () => {
  assert.deepEqual(parseEquipmentAdjustment("+0,2 CF", { target: "cost" }), { valid: true, operation: "cost_factor", value: 0.2, expression: "+0,2 CF" });
  assert.equal(parseEquipmentAdjustment("-10%", { target: "cost" }).operation, "percent");
  assert.equal(parseEquipmentAdjustment("x2/3", { target: "weight" }).value, 2 / 3);
  assert.equal(parseEquipmentAdjustment("+1 lb", { target: "weight" }).value, 0.45359237);
  assert.equal(parseEquipmentAdjustment("incompreensível", { target: "cost" }).valid, false);
});

test("normalizes legacy cost and weight fields without losing existing worlds", () => {
  const normalized = normalizeEquipmentModifier({ name: "Legado", cost_adjustment: "+1 CF", cost_factor: 1, weight_mod: "x0.5" });
  assert.equal(normalized.cost.expression, "+1 CF");
  assert.equal(normalized.cost.stage, "base");
  assert.equal(normalized.weight.expression, "x0.5");
});

test("structured defaults do not hide non-default legacy values during transition", () => {
  const normalized = normalizeEquipmentModifier({
    cost_adjustment: "+1 CF",
    weight_mod: "x0.5",
    cost_adjustment_data: { expression: "0 CF", stage: "base" },
    weight_adjustment_data: { expression: "x1", stage: "base" }
  });
  assert.equal(normalized.cost.expression, "+1 CF");
  assert.equal(normalized.weight.expression, "x0.5");
});

test("explicit structured schema may intentionally replace a legacy adjustment with its neutral value", () => {
  const normalized = normalizeEquipmentModifier({
    adjustment_schema: 1,
    cost_adjustment: "+1 CF",
    weight_mod: "x0.5",
    cost_adjustment_data: { expression: "0 CF", stage: "base" },
    weight_adjustment_data: { expression: "x1", stage: "base" }
  });
  assert.equal(normalized.cost.expression, "0 CF");
  assert.equal(normalized.weight.expression, "x1");
});

test("resolves all four cost stages with a deterministic calculation trace", () => {
  const result = resolveEquipment({ cost: 100, weight: 10, quantity: 1 }, [
    modifier({ name: "Original", cost: "+10%", costStage: "original" }),
    modifier({ name: "Base", cost: "+1 CF", costStage: "base" }),
    modifier({ name: "Base final", cost: "+20", costStage: "final_base" }),
    modifier({ name: "Final", cost: "-10%", costStage: "final" })
  ]);
  assert.equal(result.cost.unitFinal, 216);
  assert.deepEqual(result.cost.steps.map(step => step.stage), ["original", "base", "final_base", "final"]);
});

test("combines base multipliers and CF as cost factors", () => {
  const result = resolveEquipment({ cost: 100, weight: 1 }, [
    modifier({ name: "Qualidade", cost: "x4" }),
    modifier({ name: "Espinho", cost: "+0.2 CF" })
  ]);
  assert.equal(result.cost.unitFinal, 420);
});

test("resolves staged weight before cost-per-weight", () => {
  const result = resolveEquipment({ cost: 100, weight: 10 }, [
    modifier({ name: "Peso original", weight: "+1 kg", weightStage: "original" }),
    modifier({ name: "Peso-base", weight: "x0.5", weightStage: "base" }),
    modifier({ name: "Peso final", weight: "+1 kg", weightStage: "final" }),
    modifier({ name: "Preço por peso", cost: "+2", costStage: "final", perWeight: true })
  ]);
  assert.equal(result.weight.unitFinal, 6.5);
  assert.equal(result.cost.unitFinal, 113);
});

test("applies per-level scaling and quantity only after unit resolution", () => {
  const result = resolveEquipment({ cost: 10, weight: 2, quantity: 4 }, [
    modifier({ name: "Reforço", cost: "+5", costStage: "final", weight: "+0.25 kg", weightStage: "final", level: 3, perLevel: true })
  ]);
  assert.equal(result.cost.unitFinal, 25);
  assert.equal(result.cost.extendedFinal, 100);
  assert.equal(result.weight.unitFinal, 2.75);
  assert.equal(result.weight.extendedFinal, 11);
});

test("a zero-level modifier contributes no per-level adjustment", () => {
  const result = resolveEquipment({ cost: 10, weight: 2 }, [
    modifier({ name: "Inativo por nível", cost: "x4", costStage: "base", weight: "x2", weightStage: "base", level: 0, perLevel: true })
  ]);
  assert.equal(result.cost.unitFinal, 10);
  assert.equal(result.weight.unitFinal, 2);
});

test("is independent of modifier list order inside a stage", () => {
  const mods = [
    modifier({ name: "A", cost: "+10%", costStage: "final" }),
    modifier({ name: "B", cost: "+20", costStage: "final" }),
    modifier({ name: "C", cost: "x2", costStage: "final" })
  ];
  assert.equal(resolveEquipment({ cost: 100, weight: 1 }, mods).cost.unitFinal, 230);
  assert.equal(resolveEquipment({ cost: 100, weight: 1 }, [...mods].reverse()).cost.unitFinal, 230);
});

test("ignores disabled modifiers and reports invalid or unsupported expressions", () => {
  const result = resolveEquipment({ cost: 100, weight: 1 }, [
    { ...modifier({ name: "Desabilitado", cost: "+1 CF" }), enabled: false },
    modifier({ name: "Inválido", cost: "???", costStage: "final" }),
    modifier({ name: "CF final", cost: "+1 CF", costStage: "final" })
  ]);
  assert.equal(result.cost.unitFinal, 100);
  assert.deepEqual(result.warnings.map(warning => warning.type).sort(), ["invalid_expression", "unsupported_operation"]);
});

test("applies typed equipment properties with per-level scaling without mutating the base", () => {
  const equipment = { cost: 100, weight: 5, item_dr: 2 };
  const result = resolveEquipment(equipment, [{
    id: "reinforced", name: "Reforçado", level: 2,
    features_data: {
      dr: { id: "dr", label: "RD adicional", enabled: true, type: "equipment_property", path: "item_dr", operation: "add", value: 1, per_level: true }
    }
  }]);
  assert.equal(result.properties.item_dr, 4);
  assert.equal(equipment.item_dr, 2);
  assert.equal(result.steps.length, 1);
});

test("modifies attacks by group and combines formula and type changes deterministically", () => {
  const result = resolveEquipment({
    cost: 60, weight: 7,
    melee_attacks: { shield: { mode: "Golpe", groups: "golpe-com-escudo, escudo", damage_formula: "GdP", damage_type: "cont" } }
  }, [{
    id: "spike", name: "Espinho", features_data: {
      type: { id: "type", label: "Perfurante", type: "attack_property", attack_type: "melee", selector_field: "group", selector_value: "golpe-com-escudo", path: "damage_type", operation: "set", value: "perf" },
      damage: { id: "damage", label: "+1 dano", type: "attack_property", attack_type: "melee", selector_field: "group", selector_value: "golpe-com-escudo", path: "damage_formula", operation: "add", value: 1 }
    }
  }]);
  assert.equal(result.meleeAttacks.shield.damage_formula, "GdP+1");
  assert.equal(result.meleeAttacks.shield.damage_type, "perf");
  assert.equal(result.warnings.length, 0);
});

test("creates stable attack modes before applying matching attack features", () => {
  const modifierWithAttack = {
    id: "spike", name: "Espinho", features_data: {
      bonus: { id: "bonus", label: "Bônus", type: "attack_property", attack_type: "melee", selector_field: "group", selector_value: "espinho", path: "skill_level_mod", operation: "add", value: 1 },
      create: { id: "create", label: "Golpe com espinho", type: "create_attack", attack_type: "melee", attack: { mode: "Golpe com Espinho", groups: "espinho", skill_name: "Escudo", damage_formula: "GdP+1", damage_type: "perf" } }
    }
  };
  const result = resolveEquipment({ cost: 60, weight: 7 }, [modifierWithAttack]);
  assert.equal(Object.keys(result.meleeAttacks).length, 1);
  assert.equal(result.meleeAttacks.eqpmod_spike_create.mode, "Golpe com Espinho");
  assert.equal(result.meleeAttacks.eqpmod_spike_create.skill_level_mod, 1);
});

test("warns about unmatched selectors and conflicting property overrides", () => {
  const result = resolveEquipment({ cost: 1, weight: 1, quality: "comum" }, [
    { id: "a", features_data: { quality: { id: "quality", type: "equipment_property", path: "quality", operation: "set", value: "boa" } } },
    { id: "b", features_data: {
      quality: { id: "quality", type: "equipment_property", path: "quality", operation: "set", value: "excelente" },
      missing: { id: "missing", type: "attack_property", selector_field: "mode", selector_value: "Inexistente", path: "damage_type", operation: "set", value: "perf" }
    } }
  ]);
  assert.equal(result.properties.quality, "excelente");
  assert.deepEqual(result.warnings.map(warning => warning.type).sort(), ["conflicting_feature_override", "feature_no_match"]);
});
