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
  for (const field of ["combat_attack_enabled", "combat_parry_enabled", "combat_block_enabled", "combat_recalculate_parry", "combat_recalculate_block", "combat_damage_enabled"]) {
    assert.match(sheet, new RegExp(`\\.${field}\\"`));
  }
  for (const field of ["component", "property", "operation", "value", "cap"]) assert.match(sheet, new RegExp(`combat_damage_changes\\.\\{\\{change\\.index\\}\\}\\.${field}`));
  assert.match(main, /shouldRecalculate \? attack\.final_nh \+ rollOnlyAttackDelta : attackSkillNh/);
  assert.match(main, /change\.operation === "per_die"/);
  assert.match(main, /change\.operation === "extra_dice"/);
  assert.match(main, /change\.operation === "override"/);
});

test("o efeito persiste metadados de combate e usa a fórmula efetiva", () => {
  assert.match(engine, /flags\.gum\.combatModifier/);
  assert.match(engine, /attack_context: attackContext,[\s\S]*?application_side/);
  assert.match(main, /attack\.effective_damage = resolveCombatDamageProfile/);
  assert.match(main, /const effectiveDamage = resolveCombatDamageProfile/);
});

test("perfil efetivo alcança componentes, metadados, ficha e janela de dano", () => {
  const actorSheet = read("module/actor/gurps-actor-sheet.js");
  const characterTemplate = read("templates/actors/characters.hbs");
  const damagePrompt = read("module/apps/damage-roll-prompt.js");
  assert.match(main, /profile\[change\.component\]/);
  assert.match(main, /change\.property === "armor_divisor"/);
  assert.match(main, /change\.property === "type"/);
  assert.match(main, /change\.property === "nature"/);
  assert.match(actorSheet, /attack\.effective_damage\?\.follow_up/);
  assert.match(characterTemplate, /attack\.damage_nature_display/);
  assert.match(damagePrompt, /armorDivisor/);
  assert.match(damagePrompt, /formatDamageNature/);
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
  assert.match(sheet, /title="Aceita número, fórmula, dados ou expressão do motor de condições de valor\."/i);
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

test("modificadores direcionados permanecem somente na rolagem", () => {
  assert.match(engine, /application_side === "vs_targeter" \|\| containsDiceFormula\(value\)/);
});

test("modificador de todas as perícias não alcança testes diretos", () => {
  const prompt = read("module/apps/roll-prompt.js");
  assert.match(engine, /skill_roll_only: true/);
  assert.match(prompt, /entry\?\.skill_roll_only === true && this\.actor\?\.items\?\.get\(this\.rollData\?\.itemId\)\?\.type !== "skill"/);
  assert.match(main, /entry\?\.skill_roll_only === true && _getRollSourceItem/);
});

test("campos controlados não duplicam valores como arrays separados por vírgulas", () => {
  assert.doesNotMatch(sheet, /effect-disabled-field-mirror/);
  assert.match(sheetController, /normalizeControlledCsv/);
  assert.match(sheetController, /previousActions\[index\]/);
});

test("NH em árvore usa o atributo base ativo para modificadores permanentes", () => {
  assert.match(main, /collectNhBonusesForItem\(i, treeBaseAttribute\)/);
  assert.match(main, /_matchesNhDisplayContextForItem\(entry, item, baseAttribute\)/);
});

test("blocos de combate usam cabeçalhos minimalistas sem título Alterações", () => {
  assert.doesNotMatch(sheet, />\s*Alterações\s*</);
  assert.match(sheet, /effect-combat-change-header/);
  assert.match(sheet, /Bônus máximo/);
});

test("override condicional por nível mantém o escalonamento adiado", () => {
  assert.match(main, /defer_value_evaluation && entry\?\.damage_value_mode === "per_origin_level"/);
  assert.doesNotMatch(main, /damage_value_mode === "per_origin_level" && entry\?\.damage_operation !== "override"/);
  assert.match(main, /\["extra_dice", "override"\]\.includes\(entry\.damage_operation\)/);
});

test("recálculo defensivo agrega bônus direcionados antes do arredondamento", () => {
  assert.match(main, /const totalAttackBonus = applicable\.reduce/);
  assert.match(main, /const selfRollOnlyAttackBonus = _collectCombatModifierEntries/);
  assert.match(main, /Math\.floor\(\(recalculationBaseNh \+ totalAttackBonus\) \/ 2\)/);
});

test("filtro de perícia específica reconhece especialização e identificadores", () => {
  const prompt = read("module/apps/roll-prompt.js");
  assert.match(main, /item\.id, item\.uuid, item\.name, getSkillDisplayName\(item\)/);
  assert.match(prompt, /item\.id, item\.uuid, item\.name, getSkillDisplayName\(item\)/);
});

test("cabeçalhos de combate ocupam e centralizam o espaço disponível", () => {
  const css = read("styles/item-sheet.css");
  assert.match(css, /effect-combat-change-header[\s\S]*?justify-content: center/);
  assert.match(css, /effect-combat-change-header::before/);
  assert.match(css, /effect-combat-change-header \.effect-premium-checkbox[\s\S]*?border: 0/);
});

test("escopo geral ignora filtros específicos preservados", () => {
  assert.match(engine, /const specificCombatScope = action\.combat_scope === "specific"/);
  assert.match(engine, /source_item_ids: specificCombatScope \?/);
  assert.match(engine, /source_attack_ids: specificCombatScope \?/);
});

test("fórmulas com dados permanecem somente na rolagem", () => {
  assert.match(engine, /const containsDiceFormula/);
  assert.match(engine, /application_side === "vs_targeter" \|\| containsDiceFormula\(value\)/);
});

test("ações especializadas sem rótulo não recebem fallback compartilhado", () => {
  assert.match(engine, /label: action\.label \|\| ""/);
  assert.doesNotMatch(engine, /label: action\.label \|\| "Modificador de perícia"/);
  assert.doesNotMatch(engine, /label: action\.label \|\| "Modificador de modo de combate"/);
});
