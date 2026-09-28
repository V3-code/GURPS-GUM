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
  for (const field of ["combat_attack_enabled", "combat_parry_enabled", "combat_block_enabled", "combat_recalculate_parry", "combat_recalculate_block", "combat_damage_enabled", "combat_damage_operation", "combat_damage_value", "combat_damage_cap"]) {
    assert.match(sheet, new RegExp(`\\.${field}\\"`));
  }
  assert.match(main, /shouldRecalculate \? attack\.final_nh \+ rollOnlyAttackDelta : attackSkillNh/);
  assert.match(main, /damage_operation === "per_die"/);
  assert.match(main, /damage_operation === "extra_dice"/);
  assert.match(main, /damage_operation === "override"/);
});

test("o efeito persiste metadados de combate e usa a fórmula efetiva", () => {
  assert.match(engine, /flags\.gum\.combatModifier/);
  assert.match(engine, /attack_context: attackContext,[\s\S]*?application_side/);
  assert.match(main, /attack\.effective_damage_formula = _applyCombatDamageModifiers/);
  assert.match(main, /formula: resolveCombatDamageFormula\(/);
});

test("metadados de combate respeitam o lado da aplicação", () => {
  assert.match(main, /_resolveRollModifierApplicationSide\(entry, data\) !== "self"/);
  assert.match(main, /_resolveRollModifierApplicationSide\(entry, data\) !== "vs_targeter"/);
  assert.match(main, /_collectTargetCombatModifierEntries/);
  assert.match(main, /includeTargeted: true/);
  assert.match(main, /resolveTargetCombatDefenseRecalculationModifiers/);
});

test("NH, Aparar e Bloqueio preservam expressões condicionais", () => {
  assert.match(engine, /const deferValueEvaluation = hasConditionalValueExpression\(entry\.value\)/);
  assert.match(engine, /value: deferValueEvaluation \? entry\.value : scaling\.effectiveValue/);
  assert.match(main, /_evaluateCombatAttackValue/);
  assert.match(sheet, /valores de NH, Aparar e Bloqueio aceitam fórmulas e o motor de condições/i);
});

test("rolagens de modos específicos carregam item e attack id", () => {
  const characters = read("templates/actors/characters.hbs");
  assert.match(characters, /data-type="attack"[^>]*data-item-id="{{attack\.itemId}}"[^>]*data-attack-id="{{attack\.id}}"/);
  assert.match(characters, /data-defense-type="parry"[^>]*data-item-id="{{attack\.itemId}}"[^>]*data-attack-id="{{attack\.id}}"/);
  assert.match(characters, /data-defense-type="block"[^>]*data-item-id="{{attack\.itemId}}"[^>]*data-attack-id="{{attack\.id}}"/);
});

test("recálculo defensivo alcança rolagens abertas pelo prompt", () => {
  const prompt = read("module/apps/roll-prompt.js");
  assert.match(prompt, /resolveTargetCombatDefenseRecalculationModifiers/);
  assert.match(main, /attack_nh_display_mode === "include_in_nh"/);
});
