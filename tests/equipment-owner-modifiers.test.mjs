import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { collectActiveEquipmentOwnerModifiers, equipmentAttributeBonus, equipmentSkillBonus } from "../module/utils/equipment-owner-modifiers.mjs";

const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");

const equipment = (id, name, system) => ({ id, name, type: "equipment", _source: { system }, system: {} });

test("collects wearer modifiers only from equipped equipment", () => {
  const feature = { id: "skill", label: "Climbing", type: "owner_modifier", owner_kind: "skill", name_compare: "is", name_value: "Climbing", value: 2 };
  const records = collectActiveEquipmentOwnerModifiers([
    equipment("boots", "Boots", { location: "equipped", eqp_modifiers: { climber: { id: "climber", name: "Climber's", features_data: { skill: feature } } } }),
    equipment("pack", "Pack", { location: "carried", eqp_modifiers: { climber: { id: "climber", features_data: { skill: feature } } } })
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceItemName, "Boots");
  assert.equal(records[0].kind, "skill");
});

test("matches exact and contains skill bonuses case-insensitively", () => {
  const records = [
    { kind: "skill", nameCompare: "is", nameValue: "Climbing", value: 1 },
    { kind: "skill", nameCompare: "contains", nameValue: "Shield", value: 2 },
    { kind: "conditional", nameCompare: "contains", nameValue: "Shield", value: 9 }
  ];
  assert.equal(equipmentSkillBonus(records, { name: "Climbing", system: {} }), 1);
  assert.equal(equipmentSkillBonus(records, { name: "Shield", system: { specialization: "Buckler" } }), 2);
  assert.equal(equipmentSkillBonus(records, { name: "Stealth", system: {} }), 0);
});

test("sums only wearer bonuses for the requested attribute or active defense", () => {
  const records = [
    { kind: "attribute", nameValue: "per", value: -2 },
    { kind: "attribute", nameValue: "parry", value: 1 },
    { kind: "skill", nameValue: "per", value: 9 }
  ];
  assert.equal(equipmentAttributeBonus(records, "PER"), -2);
  assert.equal(equipmentAttributeBonus(records, "parry"), 1);
  assert.equal(equipmentAttributeBonus(records, "block"), 0);
});

test("normalizes GCS attribute aliases to the actor schema", () => {
  const records = [
    { kind: "attribute", nameValue: "will", value: 2 },
    { kind: "attribute", nameValue: "strength", value: 1 }
  ];
  assert.equal(equipmentAttributeBonus(records, "vont"), 2);
  assert.equal(equipmentAttributeBonus(records, "st"), 1);
});

test("wearer attribute bonuses enter the passive layer before derived calculations", () => {
  const passiveLayer = main.indexOf("attributes[attr].passive = (Number(attributes[attr].passive) || 0)");
  const intermediateLayer = main.indexOf("// --- ETAPA 4: CÁLCULOS INTERMEDIÁRIOS");
  assert.ok(passiveLayer > 0 && passiveLayer < intermediateLayer);
  assert.doesNotMatch(main, /attributes\[attr\]\.final = \(Number\(resolved\) \|\| 0\) \+ equipmentAttributeBonus/);
});
