import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sheet = read("templates/items/effect-sheet.hbs");
const sheetController = read("scripts/apps/effect-sheet.js");
const engine = read("scripts/effects-engine.js");
const main = read("scripts/main.js");

test("a ficha oferece modos especializados sem remover o modificador genérico", () => {
  assert.match(sheet, /value="roll_modifier"/);
  assert.match(sheet, /value="skill_modifier"/);
  assert.match(sheet, /value="combat_modifier"/);
  assert.match(sheet, /Restrições específicas/);
  assert.match(sheetController, /Modificar Rolagem de Perícia/);
  assert.match(sheetController, /Modificar Modo de Combate/);
});

test("modificar perícia oferece escopos, NH e motor condicional", () => {
  for (const field of ["modifier_value", "modifier_value_mode", "skill_scope", "skill_targets", "skill_attribute", "modifier_nh_display_mode"]) {
    assert.match(sheet, new RegExp(`\\.${field}\\"`));
  }
  assert.match(sheet, /Aceita número, fórmula, dados ou expressão condicional/);
  assert.match(engine, /action\.skill_scope === "attribute" \? `skill_\$\{action\.skill_attribute/);
});

test("modo de combate separa ataque, defesas, recálculo e dano", () => {
  for (const field of ["combat_attack_enabled", "combat_parry_enabled", "combat_block_enabled", "combat_recalculate_parry", "combat_recalculate_block", "combat_damage_enabled", "combat_damage_operation", "combat_damage_value"]) {
    assert.match(sheet, new RegExp(`\\.${field}\\"`));
  }
  assert.match(main, /shouldRecalculate \? attack\.final_nh : attackSkillNh/);
  assert.match(main, /damage_operation === "per_die"/);
  assert.match(main, /damage_operation === "extra_dice"/);
  assert.match(main, /damage_operation === "override"/);
});

test("o efeito persiste metadados de combate e usa a fórmula efetiva", () => {
  assert.match(engine, /flags\.gum\.combatModifier/);
  assert.match(main, /attack\.effective_damage_formula = _applyCombatDamageModifiers/);
  assert.match(main, /formula: attack\.effective_damage_formula \|\| attack\.damage_formula/);
});
