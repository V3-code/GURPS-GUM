import test from "node:test";
import assert from "node:assert/strict";

import {
  getContextualPurposeIds,
  getInitialContextualFilterState,
  getRelatedPurposeIds,
  isPurposeRelatedToEntry
} from "../module/utils/contextual-roll-purposes.mjs";
import { ROLL_PURPOSES, resolveRollMetadata } from "../module/utils/roll-purposes.mjs";
import { matchesRollTags } from "../module/utils/roll-tags.mjs";

test("sem relações o filtro contextual inicia desativado e o catálogo segue disponível", () => {
  assert.deepEqual(getRelatedPurposeIds([]), []);
  assert.equal(getInitialContextualFilterState(getContextualPurposeIds()), false);
  assert.ok(ROLL_PURPOSES.length > 1);
});

test("Hipoalgia relaciona cada componente e uma entrada só é aplicada uma vez", () => {
  const entry = { roll_tags: "resistance.pain,resistance.torture,injury.knockdown_stun", roll_tag_match: "any", modifier: 3 };
  const related = getRelatedPurposeIds([entry]);
  for (const id of ["pain", "resist_torture", "knockdown_stun"]) assert.ok(related.includes(id), id);
  const tags = resolveRollMetadata({ purposeIds: ["pain", "resist_torture", "knockdown_stun"] }).rollTags;
  assert.equal([entry].filter(action => matchesRollTags(action, tags)).reduce((sum, action) => sum + action.modifier, 0), 3);
});

test("um filtro ancestral relaciona todas as finalidades descendentes", () => {
  const related = getRelatedPurposeIds([{ roll_tags: "test.resistance" }]);
  for (const id of ["pain", "resist_poison", "resist_magic", "resist_fear"]) assert.ok(related.includes(id), id);
  assert.equal(related.includes("sense_vision"), false);
});

test("modo all exibe os componentes, mas só aplica a combinação completa", () => {
  const entry = { roll_tags: "resistance.poison,resistance.magic", roll_tag_match: "all" };
  const related = getRelatedPurposeIds([entry]);
  assert.ok(related.includes("resist_poison"));
  assert.ok(related.includes("resist_magic"));
  assert.equal(matchesRollTags(entry, resolveRollMetadata({ purposeIds: ["resist_poison"] }).rollTags), false);
  assert.equal(matchesRollTags(entry, resolveRollMetadata({ purposeIds: ["resist_poison", "resist_magic"] }).rollTags), true);
});

test("hierarquias de sentidos, memória e vetores usam a expansão central", () => {
  for (const [tag, ids] of [
    ["sense.smell_taste", ["sense_smell", "sense_taste", "sense_taste_smell"]],
    ["mental.memory", ["memorize", "recall_information"]],
    ["vector.sensory", ["sensory_vector_vision", "sensory_vector_hearing", "sensory_vector_touch"]]
  ]) {
    const related = getRelatedPurposeIds([{ roll_tags: tag }]);
    ids.forEach(id => assert.ok(related.includes(id), `${tag} -> ${id}`));
  }
});

test("solicitadas e selecionadas permanecem contextuais de forma independente", () => {
  const requested = ["resist_poison"];
  assert.deepEqual(getContextualPurposeIds({ requestedPurposeIds: requested }), requested);
  assert.deepEqual(getContextualPurposeIds({ requestedPurposeIds: requested, selectedPurposeIds: ["sense_taste"] }), ["resist_poison", "sense_taste"]);
  assert.deepEqual(getContextualPurposeIds({ requestedPurposeIds: requested, selectedPurposeIds: [] }), requested);
});

test("Teste Geral é neutro e não entra no conjunto contextual", () => {
  assert.deepEqual(getContextualPurposeIds({ selectedPurposeIds: ["general"] }), []);
  assert.deepEqual(resolveRollMetadata({ purposeIds: ["general"] }).rollTags, []);
});

test("a correspondência de visibilidade não altera a regra mecânica", () => {
  const poison = ROLL_PURPOSES.find(purpose => purpose.id === "resist_poison");
  const entry = { roll_tags: "resistance.poison,resistance.magic", roll_tag_match: "all" };
  assert.equal(isPurposeRelatedToEntry(poison, entry), true);
  assert.equal(matchesRollTags(entry, poison.tags), false);
});