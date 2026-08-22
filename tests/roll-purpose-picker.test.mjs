import test from "node:test";
import assert from "node:assert/strict";
import { buildRollPurposePickerContent, formatPurposeSelection } from "../module/apps/roll-purpose-picker.mjs";

test("resumo do seletor usa Teste Geral quando nenhuma finalidade foi escolhida", () => {
  assert.equal(formatPurposeSelection([]), "Teste Geral");
});

test("resumo do seletor apresenta os rótulos canônicos escolhidos", () => {
  assert.equal(formatPurposeSelection(["resist_poison"]), "Resistência a Veneno");
});

test("seletor usa a interface completa de busca agrupada", () => {
  const html = buildRollPurposePickerContent({ selectedIds: ["resist_poison"], attributeKey: "ht", idPrefix: "test-purpose" });

  assert.match(html, /gum-roll-tag-picker gum-purpose-picker/);
  assert.match(html, /roll-tag-selected-only/);
  assert.match(html, /roll-tag-picker-info/);
  assert.match(html, /data-search=/);
  assert.match(html, /name="roll-purpose" value="resist_poison" checked/);
  assert.match(html, /gum-purpose-suggested/);
  assert.match(html, /Nenhuma finalidade encontrada/);
});