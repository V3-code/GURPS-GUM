import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("template browser returns the selected configured-source record by selection key", async () => {
  let selected;
  const context = vm.createContext({
    FormApplication: class {},
    ui: { notifications: { warn() {}, error() {} } }
  });
  const source = fs.readFileSync("module/apps/template-browser.js", "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replace("export class ", "class ");
  vm.runInContext(`${source}\nthis.Browser = TemplateBrowser;`, context);
  const browser = new context.Browser({}, { onSelect: value => { selected = value; } });
  browser.allTemplates = [
    {
      id: "same-id",
      selectionKey: "templateSelection-0",
      uuid: "Compendium.gum.templates.Item.same-id"
    },
    {
      id: "same-id",
      selectionKey: "templateSelection-1",
      uuid: "Compendium.world.templates.Item.same-id"
    }
  ];

  await browser._updateObject(null, { selectedTemplate: "templateSelection-1" });

  assert.equal(selected.uuid, "Compendium.world.templates.Item.same-id");
});
