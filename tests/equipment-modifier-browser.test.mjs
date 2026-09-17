import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("equipment modifier browser preserves the configured source UUID", async () => {
  let update;
  const context = vm.createContext({
    FormApplication: class {},
    foundry: { utils: { randomID: () => "new" } },
    ui: { notifications: { info() {} } }
  });
  const source = fs.readFileSync("module/apps/eqp-modifier-browser.js", "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replace("export class ", "class ");
  vm.runInContext(`${source}\nthis.Browser = EqpModifierBrowser;`, context);
  const target = {
    type: "equipment",
    system: { dr_locations: {}, melee_attacks: {}, ranged_attacks: {} },
    update: async data => { update = data; }
  };
  const browser = new context.Browser(target);
  browser.allModifiers = [{
    id: "same-id",
    selectionKey: "equipmentModifierSelection-0",
    uuid: "Compendium.world.eqp-modifiers.Item.same-id",
    name: "Teste",
    system: { cost_adjustment: "+1 CF", cost_factor: 1, weight_mod: "x1" }
  }];

  await browser._updateObject(null, { "equipmentModifierSelection-0": true });

  assert.equal(update["system.eqp_modifiers.new"].name, "Teste");
  assert.equal(update["system.eqp_modifiers.new"].source_uuid, "Compendium.world.eqp-modifiers.Item.same-id");
});
