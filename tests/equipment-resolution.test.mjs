import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEquipmentConsumptionUpdate,
  describeEquipmentResolutionWarnings,
  describeEquipmentAttackChanges,
  describeEquipmentPropertyChanges,
  normalizeEquipmentModifier,
  parseEquipmentAdjustment,
  resolveEquipment
} from "../module/utils/equipment-resolution.mjs";

test("turns resolver warnings into source-aware diagnostics", () => {
  const diagnostics = describeEquipmentResolutionWarnings([
    { type: "invalid_expression", sourceName: "Leve", expression: "talvez" },
    { type: "feature_no_match", sourceId: "spike", selectorValue: "escudo" }
  ]);
  assert.equal(diagnostics[0].source, "Leve");
  assert.equal(diagnostics[0].message, "Expressão inválida: talvez.");
  assert.equal(diagnostics[1].source, "spike");
  assert.match(diagnostics[1].message, /escudo/);
});

test("keeps legacy quantity consumption unless charge mode is explicit", () => {
  assert.deepEqual(buildEquipmentConsumptionUpdate({ quantity: 3, uses_mode: "quantity" }).updates, { "system.quantity": 2 });
  const result = resolveEquipment({ quantity: 3, max_uses: 5, current_uses: 1, uses_mode: "charges", cost: 0, weight: 0 });
  assert.deepEqual(result.uses, { mode: "charges", baseMax: 5, max: 5, spent: 1, remaining: 4, consumeQuantityWhenEmpty: false });
  assert.deepEqual(buildEquipmentConsumptionUpdate({ quantity: 3, max_uses: 5, current_uses: 1, uses_mode: "charges" }, result).updates, { "system.current_uses": 2 });
});

test("does not consume quantity when explicit charge mode has zero capacity", () => {
  const consumption = buildEquipmentConsumptionUpdate({ quantity: 3, max_uses: 0, uses_mode: "charges" });
  assert.equal(consumption.consumed, false);
  assert.equal(consumption.reason, "empty_charges");
  assert.deepEqual(consumption.updates, {});
});

test("charge exhaustion can consume one unit and reset the next unit", () => {
  const equipment = { quantity: 2, max_uses: 3, current_uses: 2, uses_mode: "charges", consume_quantity_when_empty: true, cost: 0, weight: 0 };
  const consumption = buildEquipmentConsumptionUpdate(equipment, resolveEquipment(equipment));
  assert.equal(consumption.exhausted, true);
  assert.deepEqual(consumption.updates, { "system.quantity": 1, "system.current_uses": 0 });
});

test("max-use modifiers increase remaining charges while preserving spent charges", () => {
  const result = resolveEquipment({ quantity: 1, max_uses: 3, current_uses: 1, uses_mode: "charges", cost: 0, weight: 0 }, [{ id: "battery", features_data: {
    capacity: { id: "capacity", type: "equipment_property", path: "max_uses", operation: "add", value: 2 }
  }}]);
  assert.equal(result.uses.max, 5);
  assert.equal(result.uses.remaining, 4);
});

test("describes changed attack fields without replacing base sheet data", () => {
  const base = { shield: { mode: "Golpe", damage_formula: "GdP", follow_up_damage: {} } };
  const resolved = { shield: { mode: "Golpe", damage_formula: "GdP+1", follow_up_damage: { formula: "1d", type: "queim" } } };
  const changes = describeEquipmentAttackChanges(base, resolved, [
    { type: "attack_property", sourceName: "Espinho", attackType: "melee", attackId: "shield", path: "damage_formula" },
    { type: "attack_damage", sourceName: "Espinho", attackType: "melee", attackId: "shield", path: "follow_up_damage" }
  ], "melee");
  assert.equal(changes.shield.changed, true);
  assert.equal(changes.shield.created, false);
  assert.equal(changes.shield.summary, "dano, dano de acompanhamento");
  assert.equal(changes.shield.title, "Modificado por Espinho: dano, dano de acompanhamento");
  assert.equal(base.shield.damage_formula, "GdP");
});

test("describes only effective equipment property changes for sheet presentation", () => {
  const changes = describeEquipmentPropertyChanges(
    { item_dr: 2, item_hp: "10", tech_sm: 0, quality: "Comum" },
    { item_dr: 4, item_hp: 10, tech_sm: -1, quality: "Superior" }
  );
  assert.deepEqual(changes.item_dr, { base: 2, final: 4, changed: true });
  assert.deepEqual(changes.item_hp, { base: "10", final: 10, changed: false });
  assert.equal(changes.tech_sm.changed, true);
  assert.equal(changes.quality.changed, true);
});

const modifier = ({ name, cost, costStage = "base", weight = "x1", weightStage = "base", level = 1, perLevel = false, perWeight = false } = {}) => ({
  name,
  level,
  adjustment_schema: 1,
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

test("infers operation-compatible stages for legacy percentages and fixed costs", () => {
  assert.equal(normalizeEquipmentModifier({ cost_adjustment: "-10%" }).cost.stage, "original");
  assert.equal(normalizeEquipmentModifier({ cost_adjustment: "+50" }).cost.stage, "original");
  assert.equal(normalizeEquipmentModifier({ weight_mod: "-10%" }).weight.stage, "original");
  const result = resolveEquipment({ cost: 100, weight: 10 }, [{ cost_adjustment: "-10%", weight_mod: "-10%" }]);
  assert.equal(result.cost.unitFinal, 90);
  assert.equal(result.weight.unitFinal, 9);
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

test("scales a base multiplier by its CF delta", () => {
  const result = resolveEquipment({ cost: 100, weight: 1 }, [modifier({ cost: "x2", level: 2, perLevel: true })]);
  assert.equal(result.cost.unitFinal, 300);
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

test("resolves equipment defense bonus and equip time for runtime consumers", () => {
  const equipment = { cost: 150, weight: 7, defense_bonus: 2, equip_time: 3 };
  const result = resolveEquipment(equipment, [{ id: "balanced", level: 2, features_data: {
    db: { id: "db", type: "equipment_property", path: "defense_bonus", operation: "add", value: 1, per_level: true },
    ready: { id: "ready", type: "equipment_property", path: "equip_time", operation: "set", value: 1 }
  }}]);
  assert.equal(result.properties.defense_bonus, 4);
  assert.equal(result.properties.equip_time, 1);
  assert.equal(equipment.defense_bonus, 2);
  assert.equal(equipment.equip_time, 3);
});

test("accumulates decoration descriptors from multiple modifiers with their sources", () => {
  const result = resolveEquipment({ cost: 20, weight: 1, descriptors: ["Antigo"] }, [
    { id: "silver", name: "Prateado", features_data: { decoration: { id: "decoration", type: "equipment_descriptor", descriptor_kind: "appearance", value: "Cravejado de prata" } } },
    { id: "elf", name: "Élfico", features_data: { origin: { id: "origin", type: "equipment_descriptor", descriptor_kind: "origin", value: "Fabricação élfica" } } }
  ]);
  assert.deepEqual(result.descriptors.map(({ kind, value, sourceName }) => ({ kind, value, sourceName })), [
    { kind: "tag", value: "Antigo", sourceName: "Equipamento-base" },
    { kind: "origin", value: "Fabricação élfica", sourceName: "Élfico" },
    { kind: "appearance", value: "Cravejado de prata", sourceName: "Prateado" }
  ]);
});

test("accumulates material and quality text without allowing multiplication", () => {
  const result = resolveEquipment({ cost: 20, weight: 1, material: "Aço", quality: "Comum" }, [
    { id: "silver", features_data: { material: { id: "material", type: "equipment_property", path: "material", operation: "add", value: "Prata" } } },
    { id: "fine", features_data: { quality: { id: "quality", type: "equipment_property", path: "quality", operation: "add", value: "Fina" } } },
    { id: "invalid", features_data: { material: { id: "material", type: "equipment_property", path: "material", operation: "multiply", value: 2 } } }
  ]);
  assert.equal(result.properties.material, "Aço, Prata");
  assert.equal(result.properties.quality, "Comum, Fina");
  assert.equal(result.warnings.some(warning => warning.type === "unsupported_operation" && warning.path === "material"), true);
});

test("scales numeric set features per level and rejects numeric operations on textual attacks", () => {
  const result = resolveEquipment({ cost: 1, weight: 1, item_dr: 1, melee_attacks: { hit: { mode: "Golpe", damage_type: "cont" } } }, [{
    id: "scaled", level: 3, features_data: {
      dr: { id: "dr", type: "equipment_property", path: "item_dr", operation: "set", value: 2, per_level: true },
      invalid: { id: "invalid", type: "attack_property", attack_type: "melee", path: "damage_type", operation: "multiply", value: 2 }
    }
  }]);
  assert.equal(result.properties.item_dr, 6);
  assert.equal(result.meleeAttacks.hit.damage_type, "cont");
  assert.equal(result.warnings.some(warning => warning.type === "unsupported_operation" && warning.path === "damage_type"), true);
});

test("resolves location-specific DR features without mutating base armor", () => {
  const equipment = { cost: 100, weight: 5, dr_locations: { torso: { base: 3 }, skull: { base: 2, perf: 1 } } };
  const result = resolveEquipment(equipment, [{ id: "reinforced", level: 2, features_data: {
    all: { id: "all", type: "equipment_dr", location: "all", damage_type: "base", operation: "add", value: 1, per_level: true },
    skull: { id: "skull", type: "equipment_dr", location: "skull", damage_type: "perf", operation: "add", value: 2 }
  }}]);
  assert.deepEqual(result.drLocations, { torso: { base: 5 }, skull: { base: 4, perf: 3 } });
  assert.deepEqual(equipment.dr_locations, { torso: { base: 3 }, skull: { base: 2, perf: 1 } });
  assert.equal(result.steps.filter(step => step.type === "equipment_dr").length, 3);
});

test("a location-specific DR feature may create a missing armor location", () => {
  const result = resolveEquipment({ cost: 1, weight: 1, dr_locations: {} }, [{ id: "visor", features_data: {
    eyes: { id: "eyes", type: "equipment_dr", location: "eyes", damage_type: "base", operation: "set", value: 4 }
  }}]);
  assert.deepEqual(result.drLocations, { eyes: { base: 4 } });
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
  assert.equal(result.meleeAttacks.eqpmod_spike_create.parry_default, true);
  assert.equal(result.meleeAttacks.eqpmod_spike_create.block_default, true);
});

test("preserves fixed defenses on created attack modes", () => {
  const result = resolveEquipment({ cost: 1, weight: 1 }, [{ id: "shield", features_data: {
    create: {
      id: "create", type: "create_attack", attack_type: "melee",
      attack: { mode: "Investida", parry: "11", block: "10", parry_default: false, block_default: false }
    }
  }}]);
  const attack = result.meleeAttacks.eqpmod_shield_create;
  assert.equal(attack.parry, "11");
  assert.equal(attack.block, "10");
  assert.equal(attack.parry_default, false);
  assert.equal(attack.block_default, false);
});

test("defines follow-up and fragmentation damage on selected attacks", () => {
  const result = resolveEquipment({ cost: 10, weight: 1, melee_attacks: {
    spike: { mode: "Espinho", groups: "escudo", follow_up_damage: {}, fragmentation_damage: {} },
    pommel: { mode: "Pomo", groups: "pomo", follow_up_damage: {}, fragmentation_damage: {} }
  } }, [{ id: "enchanted", features_data: {
    follow: { id: "follow", type: "attack_damage", attack_type: "melee", selector_field: "group", selector_value: "escudo", damage_slot: "follow_up_damage", damage: { formula: "1d-1", type: "queim", nature: "FOG", armor_divisor: 2, scaling: "+1/nível" } },
    frag: { id: "frag", type: "attack_damage", attack_type: "melee", selector_field: "mode", selector_value: "Espinho", damage_slot: "fragmentation_damage", damage: { formula: "1d", type: "cort" } }
  }}]);
  assert.deepEqual(result.meleeAttacks.spike.follow_up_damage, { formula: "1d-1", type: "queim", nature: "FOG", armor_divisor: 2, scaling: "+1/nível" });
  assert.deepEqual(result.meleeAttacks.spike.fragmentation_damage, { formula: "1d", type: "cort", nature: "", armor_divisor: 1, scaling: "" });
  assert.deepEqual(result.meleeAttacks.pommel.follow_up_damage, {});
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

test("resolves granted effects as declarative records and reports missing UUIDs", () => {
  const result = resolveEquipment({ cost: 1, weight: 1 }, [{
    id: "enchanted", name: "Encantado", features_data: {
      valid: { id: "valid", label: "Proteção", type: "granted_effect", effect_uuid: "Compendium.world.effects.Item.protection", effect_domain: "wearer", lifecycle: "while_equipped" },
      invalid: { id: "invalid", label: "Sem vínculo", type: "granted_effect", effect_uuid: "", effect_domain: "wearer" }
    }
  }]);
  assert.deepEqual(result.grantedEffects, [{
    id: "enchanted:valid", sourceModifierId: "enchanted", sourceModifierName: "Encantado", featureId: "valid",
    label: "Proteção", effectUuid: "Compendium.world.effects.Item.protection", domain: "wearer", lifecycle: "while_equipped",
    attackType: "all", selectorField: "all", selectorValue: "", minInjury: 0, activationChance: 100, requiredDamageType: ""
  }]);
  assert.equal(result.warnings.some(warning => warning.type === "missing_effect_uuid"), true);
});

test("projects hit-target grants into matching attack on-damage effects", () => {
  const result = resolveEquipment({
    cost: 1, weight: 1, location: "equipped",
    melee_attacks: {
      shield: { mode: "Golpe", groups: "golpe-com-escudo", onDamageEffects: {} },
      pommel: { mode: "Pomo", groups: "pomo", onDamageEffects: {} }
    }
  }, [{ id: "spike", name: "Espinho", features_data: {
    bleed: {
      id: "bleed", label: "Sangramento", type: "granted_effect", effect_uuid: "Item.bleed",
      effect_domain: "hit_target", lifecycle: "while_equipped", attack_type: "melee",
      selector_field: "group", selector_value: "golpe-com-escudo", min_injury: 1,
      activation_chance: 75, required_damage_type: "perf"
    }
  }}]);
  const link = result.meleeAttacks.shield.onDamageEffects.eqpmod_spike_bleed;
  assert.equal(link.effectUuid, "Item.bleed");
  assert.equal(link.minInjury, 1);
  assert.equal(link.activationChance, 75);
  assert.equal(link.requiredDamageType, "perf");
  assert.deepEqual(result.meleeAttacks.pommel.onDamageEffects, {});
});

test("does not project a hit-target effect when its attack scope is none", () => {
  const result = resolveEquipment({
    cost: 1, weight: 1, location: "equipped",
    melee_attacks: { shield: { mode: "Golpe", onDamageEffects: {} } }
  }, [{ id: "spike", name: "Espinho", features_data: {
    dormant: {
      id: "dormant", label: "Inativo", type: "granted_effect", effect_uuid: "Item.dormant",
      effect_domain: "hit_target", lifecycle: "while_equipped", attack_type: "none"
    }
  }}]);
  assert.equal(result.grantedEffects[0].attackType, "none");
  assert.deepEqual(result.meleeAttacks.shield.onDamageEffects, {});
});
