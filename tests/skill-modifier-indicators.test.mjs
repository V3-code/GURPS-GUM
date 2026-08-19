import test from "node:test";
import assert from "node:assert/strict";
import { buildSkillModifierIndicators } from "../module/utils/skill-modifier-indicators.mjs";

const skill = { type: "skill", name: "Furtividade" };
const effect = (name, entries) => ({ name, rollModifier: { entries } });

test("separa modificadores incorporados e de rolagem sem sinalizar condicionais", () => {
  const result = buildSkillModifierIndicators({
    skill,
    passive: 1,
    effects: [effect("Bênção", [
      { value: 2, nh_display_mode: "include_in_nh" },
      { value: -1, nh_display_mode: "roll_only" },
      { value: 3, nh_display_mode: "roll_only", roll_tags: "resistance.poison" }
    ])]
  });

  assert.equal(result.included.visible, true);
  assert.equal(result.included.total, 3);
  assert.match(result.included.title, /valor já incorporado/);
  assert.equal(result.roll.total, -1);
  assert.equal(result.roll.className, "is-negative");
  assert.equal("conditional" in result, false);
});

test("mantém ROL visível quando modificadores se anulam e ignora entradas de alvo", () => {
  const result = buildSkillModifierIndicators({
    skill,
    effects: [effect("Postura", [
      { value: 2 },
      { value: -2 },
      { value: 8, application_side: "vs_targeter" }
    ])]
  });

  assert.equal(result.roll.visible, true);
  assert.equal(result.roll.total, 0);
  assert.equal(result.roll.className, "is-positive");
  assert.doesNotMatch(result.roll.title, /\+8/);
});

test("respeita os filtros da perícia e omite include_in_nh condicionado por finalidade", () => {
  const result = buildSkillModifierIndicators({
    skill,
    effects: [effect("Treinamento", [
      { value: 4, target_values: "Outra" },
      { value: 2, nh_display_mode: "include_in_nh", roll_tags: "source.magic" }
    ])],
    matchesTarget: (entry, item) => !entry.target_values || entry.target_values === item.name
  });

  assert.equal(result.included.visible, false);
  assert.equal(result.roll.visible, false);
  assert.equal("conditional" in result, false);
});