import test from "node:test";
import assert from "node:assert/strict";
import {
  getGroupedRollPurposes,
  getPurposeLabels,
  matchesRollTags,
  normalizePurposeIds,
  resolveRollMetadata,
  shouldIncludeInPermanentNh
} from "../module/utils/roll-purposes.mjs";

test("uma finalidade resolve seus metadados canônicos", () => {
  assert.deepEqual(resolveRollMetadata({ context: "check_ht", attributeKey: "ht", purposeIds: ["resist_poison"] }), {
    context: "check_ht", attributeKey: "ht", purposeIds: ["resist_poison"], rollTags: ["resistance", "poison"]
  });
});

test("múltiplas finalidades unem e deduplicam tags em ordem estável", () => {
  const result = resolveRollMetadata({ purposeIds: ["resist_poison", "resist_disease", "pain", "resist_poison"] });
  assert.deepEqual(result.purposeIds, ["resist_poison", "resist_disease", "pain"]);
  assert.deepEqual(result.rollTags, ["resistance", "poison", "disease", "pain"]);
});

test("Teste Geral limpa e finalidades desconhecidas são ignoradas", () => {
  assert.deepEqual(normalizePurposeIds(["general", "unknown"]), []);
  assert.deepEqual(resolveRollMetadata({ purposeIds: [] }).rollTags, []);
});

test("filtro any aceita ao menos um marcador", () => {
  assert.equal(matchesRollTags({ roll_tags: "poison, disease", roll_tag_match: "any" }, ["poison"]), true);
  assert.equal(matchesRollTags({ roll_tags: "poison, disease", roll_tag_match: "any" }, ["pain"]), false);
});

test("filtro all exige todos os marcadores", () => {
  assert.equal(matchesRollTags({ roll_tags: ["resistance", "poison"], roll_tag_match: "all" }, ["poison", "resistance"]), true);
  assert.equal(matchesRollTags({ roll_tags: ["resistance", "poison"], roll_tag_match: "all" }, ["poison"]), false);
});

test("entrada antiga sem tags continua aplicável", () => {
  assert.equal(matchesRollTags({ contexts: "check" }, []), true);
});

test("entrada com tags não se aplica ao Teste Geral", () => {
  assert.equal(matchesRollTags({ roll_tags: "poison" }, resolveRollMetadata({ purposeIds: [] }).rollTags), false);
});

test("modificador semântico nunca entra no NH permanente", () => {
  assert.equal(shouldIncludeInPermanentNh({ nh_display_mode: "include_in_nh", roll_tags: "poison" }), false);
});

test("Talento legado include_in_nh permanece inalterado", () => {
  assert.equal(shouldIncludeInPermanentNh({ nh_display_mode: "include_in_nh" }), true);
});

test("metadados preservam finalidades ao trocar HT por Vontade", () => {
  const ids = ["resist_poison", "pain"];
  assert.deepEqual(resolveRollMetadata({ context: "check_vont", attributeKey: "vont", purposeIds: ids }).purposeIds, ids);
});

test("seleções repetidas são idempotentes e não duplicam", () => {
  assert.deepEqual(normalizePurposeIds(["pain", "pain", "resist_poison", "pain"]), ["pain", "resist_poison"]);
});

test("registro mantém todas as finalidades visíveis e apenas sugere atributo", () => {
  const ht = getGroupedRollPurposes("ht", ["resist_poison"]);
  const vont = getGroupedRollPurposes("vont", ["resist_poison"]);
  assert.equal(ht.flatMap(group => group.purposes).length, 16);
  assert.equal(vont.flatMap(group => group.purposes).length, 16);
  assert.equal(vont.flatMap(group => group.purposes).find(p => p.id === "resist_poison").selected, true);
});

test("labels amigáveis não expõem identificadores", () => {
  assert.deepEqual(getPurposeLabels(["resist_poison", "pain"]), ["Resistência a Veneno", "Dor"]);
});

test("purposeIds serializam sem perda para macros e rolagens rápidas", () => {
  const rollData = { quick: true, purposeIds: ["fright_check", "pain"] };
  assert.deepEqual(JSON.parse(JSON.stringify(rollData)).purposeIds, rollData.purposeIds);
  assert.deepEqual(resolveRollMetadata(JSON.parse(JSON.stringify(rollData))).rollTags, ["resistance", "fright", "fear", "pain"]);
});