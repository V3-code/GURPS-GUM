import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRollPurposePickerContent, formatPurposeSelection } from "../module/apps/roll-purpose-picker.mjs";

const makeI18n = language => {
  const catalog = JSON.parse(readFileSync(new URL(`../lang/${language}.json`, import.meta.url), "utf8"));
  const get = key => key.split(".").reduce((value, part) => value?.[part], catalog);
  return { lang: language, localize: key => get(key) ?? key, format: (key, data = {}) => String(get(key) ?? key).replace(/\{([^}]+)\}/g, (_match, name) => data[name] ?? `{${name}}`) };
};
const ptI18n = makeI18n("pt-BR");
const enI18n = makeI18n("en");
globalThis.game = { i18n: ptI18n };

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

test("seletor e resumo acompanham o idioma sem alterar os IDs", () => {
  assert.equal(formatPurposeSelection(["resist_poison"], { i18n: enI18n }), "Resist Poison");
  assert.equal(formatPurposeSelection([], { i18n: enI18n }), "General Test");
  const html = buildRollPurposePickerContent({ selectedIds: ["resist_poison"], attributeKey: "ht", idPrefix: "english-purpose", i18n: enI18n });
  assert.match(html, /Physical Resistances/);
  assert.match(html, /Resist Poison/);
  assert.match(html, /Search purposes by name/);
  assert.match(html, /No purposes found/);
  assert.match(html, /name="roll-purpose" value="resist_poison" checked/);
});
