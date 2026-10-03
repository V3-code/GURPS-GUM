import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync("module/apps/importers.js", "utf8");
const start = source.indexOf("function parseGCSLibraryEquipmentModifier");
const end = source.indexOf("function normalizeGCSDamageFormula", start);
const functionSource = source.slice(start, end);

test("GCS equipment modifier import preserves stages and scaling controls", () => {
  const context = vm.createContext({
    getSystemTemplate: () => ({}),
    getGCSItemNotes: () => "Somente lâminas"
  });
  vm.runInContext(`${functionSource}\nthis.parseModifier = parseGCSLibraryEquipmentModifier;`, context);

  const result = context.parseModifier({
    name: "Qualidade Superior",
    cost: "x4",
    cost_type: "to_base_cost",
    cost_is_per_level: true,
    cost_is_per_pound: true,
    weight: "+1 lb",
    weight_type: "to_original_weight",
    weight_is_per_level: true,
    reference: "B274"
  });

  assert.equal(result.system.adjustment_schema, 1);
  assert.equal(result.system.cost_adjustment_data.expression, "x4");
  assert.equal(result.system.cost_adjustment_data.stage, "base");
  assert.equal(result.system.cost_adjustment_data.per_level, true);
  assert.equal(result.system.cost_adjustment_data.per_weight, true);
  assert.equal(result.system.cost_adjustment_data.per_weight_unit, "lb");
  assert.equal(result.system.weight_adjustment_data.expression, "+1 lb");
  assert.equal(result.system.weight_adjustment_data.stage, "original");
  assert.equal(result.system.weight_adjustment_data.per_level, true);
  assert.match(result.system.features, /Peso GCS: \+1 lb/);
});

test("GCS equipment modifier import converts supported features and preserves the rest", () => {
  const context = vm.createContext({ getSystemTemplate: () => ({ features_data: {} }), getGCSItemNotes: () => "" });
  vm.runInContext(`${functionSource}\nthis.parseModifier = parseGCSLibraryEquipmentModifier;`, context);
  const result = context.parseModifier({ name: "Tecnológico", features: [
    { type: "dr_bonus", locations: ["torso", "skull"], specialization: "all", amount: 2, per_level: true },
    { type: "equipment_max_uses_bonus", amount: "x2" },
    { type: "weapon_bonus", selection_type: "weapons_with_required_skill", name: { qualifier: "Escudo" }, amount: 1, leveled: true },
    { type: "weapon_parry_bonus", amount: 1 },
    { type: "equipment_max_uses_bonus", amount: "+10%" }
  ] });
  const features = JSON.parse(JSON.stringify(result.system.features_data));
  assert.equal(features["gcs-0-dr-0"].type, "equipment_dr");
  assert.equal(features["gcs-0-dr-1"].location, "skull");
  assert.equal(features["gcs-1"].path, "max_uses");
  assert.equal(features["gcs-1"].operation, "multiply");
  assert.equal(features["gcs-2"].path, "damage_formula");
  assert.equal(features["gcs-2"].selector_field, "skill_name");
  assert.equal(features["gcs-2"].selector_value, "Escudo");
  assert.equal(result.system.gcs_features_unmapped.length, 2);
  assert.match(result.system.features, /2 feature\(s\) GCS preservada\(s\)/);
});
