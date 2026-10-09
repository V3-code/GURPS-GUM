import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { templateEntryDisplayName } from "../module/utils/template-entry-display.mjs";

const calls = [];
const context = vm.createContext({
  foundry: { utils: { escapeHTML: value => String(value).replaceAll("<", "&lt;") } },
  game: { i18n: { localize: key => key } },
  GumPreviewDialog: {
    showItem: async (...args) => calls.push(["item", ...args]),
    show: async (...args) => calls.push(["group", ...args]),
    enrichDescription: async value => value || "No description"
  },
  templateEntryDisplayName
});
const source = fs.readFileSync("module/apps/template-entry-preview.js", "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
vm.runInContext(source, context);

test("item preview uses the existing quick view, REF, and specialized title without changing source data", async () => {
  calls.length = 0;
  const entry = { kind: "item", name: "Survival", specialization: "Arctic", itemType: "skill",
    inlineItem: { name: "Survival", type: "skill", system: { specialization: "Arctic", ref: "B223" } } };
  await context.showTemplateEntryPreview(entry);
  assert.equal(calls[0][0], "item");
  assert.equal(calls[0][1].name, "Survival (Arctic)");
  assert.equal(calls[0][1].system.ref, "B223");
  assert.equal(calls[0][2].sendToChat, false);
  assert.equal(entry.inlineItem.name, "Survival");
});

test("linked preview keeps the imported REF when the matched source lacks it", async () => {
  calls.length = 0;
  await context.showTemplateEntryPreview({ kind: "item", name: "Survival", itemType: "skill", ref: "B223" }, {
    sourceItem: { name: "Survival", type: "skill", system: {} }
  });
  assert.equal(calls[0][1].system.ref, "B223");
});

test("preview reflects the selected level, cost, and equipment quantity", async () => {
  calls.length = 0;
  await context.showTemplateEntryPreview({ kind: "item", name: "Mimicry", itemType: "skill", level: 2, cost: 4,
    inlineItem: { name: "Mimicry", type: "skill", system: { skill_level: 0, points: 1 } } });
  assert.equal(calls[0][1].system.skill_level, 2);
  assert.equal(calls[0][1].system.points, 4);
  await context.showTemplateEntryPreview({ kind: "item", name: "Rope", itemType: "equipment", quantity: 3, cost: 10,
    inlineItem: { name: "Rope", type: "equipment", system: { quantity: 1, cost: 10 } } });
  assert.equal(calls[1][1].system.quantity, 3);
  assert.equal(calls[1][1].system.cost, 10);
});

test("package preview lists included options and preserves REF", async () => {
  calls.length = 0;
  await context.showTemplateEntryPreview({ kind: "group", name: "Kit", ref: "B1", subBlocks: [
    { title: "Choose", contents: [{ name: "Rope" }, { name: "Torch" }] }
  ] });
  assert.equal(calls[0][0], "group");
  assert.match(calls[0][1].description, /Rope, Torch/);
  assert.deepEqual(Array.from(calls[0][1].tags, tag => tag.value), ["B1"]);
});
