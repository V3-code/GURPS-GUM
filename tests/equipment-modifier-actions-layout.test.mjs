import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const template = fs.readFileSync("templates/items/item-sheet.hbs", "utf8");
const sheet = fs.readFileSync("module/item/gurps-item-sheet.js", "utf8");
const main = fs.readFileSync("scripts/main.js", "utf8");

test("equipment modifier sheet exposes its own action editor and functional requirements", () => {
  for (const type of ["pricing", "equipment_property", "attack_property", "attack_create"]) {
    assert.match(template, new RegExp(`value="${type}"`));
  }
  for (const selector of ["all", "melee", "ranged", "ids"]) {
    assert.match(template, new RegExp(`value="${selector}"`));
  }
  assert.match(template, /system\.requirements\.all/);
  assert.match(template, /add-eqp-modifier-action/);
  assert.match(sheet, /system\.actions/);
  assert.match(sheet, /delete-eqp-modifier-action[\s\S]*?await this\._onSubmit\(event\)[\s\S]*?normalizeEquipmentModifierActions\(this\.item\.system\.actions/);
  assert.match(sheet, /collectEquipmentModifierActionsFromForm\(formData\)/);
  assert.match(template, /data-eqp-action-type/);
  assert.match(template, /Compatibilidade com campos antigos/);
});

test("equipment view presents the centralized calculation memory", () => {
  assert.match(template, /equipmentCalculation\.cost\.steps/);
  assert.match(template, /equipmentCalculation\.weight\.steps/);
  assert.match(sheet, /prepareEquipment\(context\.system, eqpModsObj\)/);
  assert.match(sheet, /context\.system = foundry\.utils\.deepClone\(this\.item\._source\.system\)/);
  assert.match(main, /prepareEquipment\(sourceSystem, sourceSystem\.eqp_modifiers/);
});
