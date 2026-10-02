import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const template = fs.readFileSync("templates/items/item-sheet.hbs", "utf8");
const itemSheet = fs.readFileSync("module/item/gurps-item-sheet.js", "utf8");
const main = fs.readFileSync("scripts/main.js", "utf8");

test("equipment modifier sheet exposes structured cost and weight controls", () => {
  assert.match(template, /data-tab="adjustments"/);
  for (const field of [
    "system.cost_adjustment_data.expression",
    "system.cost_adjustment_data.stage",
    "system.cost_adjustment_data.per_level",
    "system.cost_adjustment_data.per_weight",
    "system.weight_adjustment_data.expression",
    "system.weight_adjustment_data.stage",
    "system.weight_adjustment_data.per_level"
  ]) assert.match(template, new RegExp(field.replaceAll(".", "\\.")));
});

test("item sheet and actor preparation delegate to the central resolver", () => {
  assert.match(itemSheet, /resolveEquipment\(baseEquipmentSystem, eqpModsObj\)/);
  assert.match(main, /const resolution = resolveEquipment\(item\._source\?\.system \|\| item\.system\)/);
  assert.match(main, /effectiveWeight = resolution\.weight\.unitFinal/);
  assert.match(main, /effectiveCost = resolution\.cost\.unitFinal/);
});

test("equipment modifier instances expose enabled, level and resolved totals", () => {
  assert.match(template, /system\.eqp_modifiers\.\{\{mod\.id\}\}\.enabled/);
  assert.match(template, /system\.eqp_modifiers\.\{\{mod\.id\}\}\.level/);
  assert.match(template, /Resultado resolvido/);
  assert.match(template, /equipmentResolution\.warnings\.length/);
});

test("equipment modifier sheet exposes typed feature authoring", () => {
  assert.match(template, /data-tab="equipment-features"/);
  assert.match(template, /add-eqp-feature/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.type/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.selector_field/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.attack\.damage_formula/);
  assert.match(itemSheet, /system\.features_data\.\$\{id\}/);
  assert.match(main, /item\.system\.melee_attacks = resolution\.meleeAttacks/);
  assert.match(main, /item\.system\.ranged_attacks = resolution\.rangedAttacks/);
});
