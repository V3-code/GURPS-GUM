import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const template = fs.readFileSync("templates/items/item-sheet.hbs", "utf8");
const itemSheet = fs.readFileSync("module/item/gurps-item-sheet.js", "utf8");
const main = fs.readFileSync("scripts/main.js", "utf8");
const effectsEngine = fs.readFileSync("scripts/effects-engine.js", "utf8");
const rollPrompt = fs.readFileSync("module/apps/roll-prompt.js", "utf8");

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

test("equipment details distinguish base and feature-resolved property values", () => {
  assert.match(itemSheet, /describeEquipmentPropertyChanges\(baseEquipmentSystem, resolution\.properties\)/);
  for (const property of ["tech_sm", "item_dr", "item_hp", "item_ht", "holdout", "legality_class", "quality", "material"]) {
    assert.match(template, new RegExp(`equipmentPropertyChanges\\.${property}\\.changed`));
    assert.match(template, new RegExp(`equipmentPropertyChanges\\.${property}\\.final`));
  }
  assert.match(template, /Memória das features/);
  assert.match(template, /step\.input/);
  assert.match(template, /step\.output/);
  assert.match(template, /fa-arrow-right/);
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
  assert.match(main, /item\.system\.dr_locations = resolution\.drLocations/);
  assert.match(template, /eq feature\.type "equipment_dr"/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.location/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.damage_type/);
  assert.match(template, /row\.finalDr/);
});

test("equipment active toggle explains its limited lifecycle purpose", () => {
  assert.match(template, /Ligado \/ Ativo/);
  assert.match(template, /equipment-operational-toggle/);
  assert.match(template, /Estado operacional usado por efeitos “Enquanto ativado”/);
  assert.match(template, /não substitui Carregado ou Equipado/);
});

test("granted effects expose UUID, domain and lifecycle and are synchronized by item hooks", () => {
  assert.match(template, /eq feature\.type "granted_effect"/);
  assert.match(itemSheet, /id: "granted_effect", label: "Conceder efeito"/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.effect_uuid/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.effect_domain/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.lifecycle/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.min_injury/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.activation_chance/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.required_damage_type/);
  assert.match(template, /select-eqp-feature-effect/);
  assert.match(template, /view-eqp-feature-effect/);
  assert.match(template, /feature\.effect_name/);
  assert.match(itemSheet, /new EffectBrowser\(this\.item/);
  assert.match(itemSheet, /system\.features_data\.\$\{id\}\.effect_uuid/);
  assert.match(itemSheet, /fromUuid\(uuid\)/);
  assert.match(template, /name="system\.active"/);
  assert.match(main, /syncEquipmentModifierGrantedEffects\(item\)/);
  assert.match(main, /source: EQUIPMENT_GRANTED_EFFECT_SOURCE/);
  assert.match(main, /skipInstantEffects: true/);
  assert.match(main, /matchesEquipmentGrantedEffectScope/);
  assert.match(effectsEngine, /\.\.\.\(context\.gumFlags \|\| \{\}\)/);
  assert.match(rollPrompt, /matchesEquipmentGrantedEffectScope/);
});

test("created attack editor exposes specialized melee and ranged statistics", () => {
  for (const field of ["skill_level_mod", "min_strength", "parry", "block", "accuracy", "rof", "shots", "rcl"]) {
    assert.match(template, new RegExp(`features_data\\.\\{\\{feature\\.id\\}\\}\\.attack\\.${field}`));
  }
  assert.match(itemSheet, /numeric_equipment_value/);
  assert.match(itemSheet, /numeric_attack_value/);
});

test("equipment modifiers author structured follow-up and fragmentation damage", () => {
  assert.match(template, /eq feature\.type "attack_damage"/);
  assert.match(template, /system\.features_data\.\{\{feature\.id\}\}\.damage_slot/);
  for (const field of ["formula", "type", "nature", "armor_divisor", "scaling"]) {
    assert.match(template, new RegExp(`features_data\\.\\{\\{feature\\.id\\}\\}\\.damage\\.${field}`));
  }
  assert.match(itemSheet, /id: "attack_damage", label: "Definir dano secundário ou fragmentação"/);
});

test("equipment attack cards identify modes changed by resolved features", () => {
  assert.match(itemSheet, /describeEquipmentAttackChanges\(baseEquipmentSystem\.melee_attacks, resolution\.meleeAttacks/);
  assert.match(itemSheet, /describeEquipmentAttackChanges\(baseEquipmentSystem\.ranged_attacks, resolution\.rangedAttacks/);
  assert.match(template, /equipmentMeleeAttackChanges/);
  assert.match(template, /equipmentRangedAttackChanges/);
  assert.match(template, /equipment-modifier-indicator/);
  assert.match(template, /fa-wrench/);
});
