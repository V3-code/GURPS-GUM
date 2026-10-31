import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesAbilityClassificationFilters,
  matchesAbilityRollContext,
  resolveAbilityRollContext,
  resolveAbilitySheetGroup
} from "../module/utils/ability-roll-context.mjs";

test("resolve contextos compostos para habilidades baseadas diretamente em atributo", () => {
  assert.equal(resolveAbilityRollContext("spell", { item: { type: "spell", system: { base_attribute: "DX", base_attribute_type: "attribute" } } }), "spell_dx");
  assert.equal(resolveAbilityRollContext("power", { item: { type: "power", system: { base_attribute: "Vontade", base_attribute_type: "attribute" } } }), "power_vont");
  assert.equal(resolveAbilityRollContext("spell", { item: { type: "spell", system: { base_attribute: "Taumatologia", base_attribute_type: "skill" } } }), "spell");
});

test("contextos gerais abrangem seus contextos compostos sem perder especificidade", () => {
  assert.equal(matchesAbilityRollContext("spell", "spell_dx"), true);
  assert.equal(matchesAbilityRollContext("spell_dx", "spell_dx"), true);
  assert.equal(matchesAbilityRollContext("spell_iq", "spell_dx"), false);
  assert.equal(matchesAbilityRollContext("power", "power_iq"), true);
  assert.equal(matchesAbilityRollContext("skill", "spell_iq"), false);
});

test("filtros classificatorios combinam fonte, grupo, escola e classe", () => {
  const spell = { type: "spell", system: { source: "Magia Árcana", group: "Evocação", spell_school: "Fogo", spell_class: "Comum" } };
  assert.equal(matchesAbilityClassificationFilters({ ability_sources: "magia arcana", ability_schools: "Fogo" }, spell), true);
  assert.equal(matchesAbilityClassificationFilters({ ability_sources: "Divina, Druídica" }, spell), false);
  assert.equal(matchesAbilityClassificationFilters({ ability_groups: "Evocação", ability_classes: "Comum" }, spell), true);
});

test("grupo visual da ficha permanece independente do grupo de classificação", () => {
  const actor = { system: { skill_organization: {
    groups: { combat: { name: "Combate" } },
    assignments: { sword: "combat" }
  } } };
  const skill = { id: "sword", type: "skill", actor, system: { group: "Armas" } };

  assert.equal(resolveAbilitySheetGroup(skill), "Combate");
  assert.equal(matchesAbilityClassificationFilters({ ability_groups: "Armas" }, skill), true);
  assert.equal(matchesAbilityClassificationFilters({ ability_sheet_groups: "Combate" }, skill), true);
  assert.equal(matchesAbilityClassificationFilters({ ability_groups: "Combate" }, skill), false);
  assert.equal(matchesAbilityClassificationFilters({ ability_groups: "Armas", ability_sheet_groups: "Combate" }, skill), true);
});
