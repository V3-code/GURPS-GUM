import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

class ItemSheetStub {}
globalThis.foundry = {
  appv1: { sheets: { ItemSheet: ItemSheetStub } },
  applications: { ux: { TextEditor: { implementation: {} } } },
  utils: {
    escapeHTML: value => String(value ?? ""),
    randomID: () => "generated-id"
  }
};
globalThis.TextEditor = {};

const makeI18n = language => {
  const catalog = JSON.parse(readFileSync(new URL(`../lang/${language}.json`, import.meta.url), "utf8"));
  const get = key => key.split(".").reduce((value, part) => value?.[part], catalog);
  return {
    lang: language,
    localize: key => get(key) ?? key,
    format: (key, data = {}) => String(get(key) ?? key).replace(/\{([^}]+)\}/g, (_match, name) => data[name] ?? `{${name}}`)
  };
};

const { TemplateItemSheet } = await import("../module/item/template-item-sheet.js");
const sheet = Object.create(TemplateItemSheet.prototype);

test("template item presentation follows the active language", () => {
  globalThis.game = { i18n: makeI18n("en") };
  sheet.item = { name: "Knight" };
  assert.equal(sheet.title, "Template: Knight");
  assert.equal(sheet._getItemTypeLabel("advantage"), "Advantage");
  assert.equal(sheet._getBlockTypeLabel("points"), "Point Allocation");
  assert.equal(sheet._getAttributeLabel("will"), "Will");
  assert.equal(sheet._getAttributeLabel("hp"), "HP");
  assert.equal(sheet._buildAttributeRowName({ label: "Atributos", attributes: {} }), "Attributes");
  assert.equal(sheet._getItemDifficulty({ system: { difficulty: "VH" } }), "Very Hard");
  assert.equal(sheet._buildBlockSummary({ type: "selection", choiceCount: 2 }, [{}, {}]), "2 items • choose 2");
  assert.match(sheet._getPointsPerLevelInfo({ system: { difficulty: "TecD" } }), /Hard technique progression/);

  globalThis.game = { i18n: makeI18n("pt-BR") };
  assert.equal(sheet.title, "Modelo: Knight");
  assert.equal(sheet._getItemTypeLabel("advantage"), "Vantagem");
  assert.equal(sheet._getAttributeLabel("will"), "Vont");
  assert.equal(sheet._getItemDifficulty({ system: { difficulty: "VH" } }), "Muito Difícil");
});

test("template item mechanics remain independent from localization", () => {
  globalThis.game = { i18n: makeI18n("en") };
  const blocks = sheet._normalizeGroupSubBlocks([
    { id: "block-a", type: "selection", title: "Choice", choiceCount: 2, pointsAvailable: 7, contents: [{ id: "entry-a" }] },
    { id: "block-b", type: "invalid", choiceCount: 0, pointsAvailable: "5", contents: null }
  ]);
  assert.deepEqual(blocks, [
    { id: "block-a", type: "selection", title: "Choice", choiceCount: 2, pointsAvailable: 7, contents: [{ id: "entry-a" }] },
    { id: "block-b", type: "guaranteed", title: "", choiceCount: 1, pointsAvailable: 5, contents: [] }
  ]);
  assert.equal(sheet._calculateAttributeCost({ st: 1, basic_speed: 0.25 }, { st: 10, basic_speed: 5 }), 15);
  assert.equal(sheet._calculateLevelledItemCost({ system: { difficulty: "D" } }, 2), 12);
  assert.equal(sheet._calculateLevelledItemCost({ system: { difficulty: "TecD" } }, 3), 4);
});
