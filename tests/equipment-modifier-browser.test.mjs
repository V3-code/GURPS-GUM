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
    system: {
      cost_adjustment: "+1 CF",
      cost_factor: 1,
      weight_mod: "x1",
      group: "Qualidade",
      adjustment_schema: 1,
      cost_adjustment_data: { expression: "+1 CF", stage: "base" },
      weight_adjustment_data: { expression: "x1", stage: "base" },
      features_data: { dr: { id: "dr", type: "equipment_property", path: "item_dr", operation: "add", value: 1 } },
      gcs_features_unmapped: [{ type: "weapon_parry_bonus", amount: 1 }]
    }
  }];

  await browser._updateObject(null, { "equipmentModifierSelection-0": true });

  assert.equal(update["system.eqp_modifiers.new"].name, "Teste");
  assert.equal(update["system.eqp_modifiers.new"].source_uuid, "Compendium.world.eqp-modifiers.Item.same-id");
  assert.equal(update["system.eqp_modifiers.new"].adjustment_schema, 1);
  assert.equal(update["system.eqp_modifiers.new"].group, "Qualidade");
  assert.equal(update["system.eqp_modifiers.new"].cost_adjustment_data.stage, "base");
  assert.equal(update["system.eqp_modifiers.new"].features_data.dr.path, "item_dr");
  assert.equal(update["system.eqp_modifiers.new"].gcs_features_unmapped[0].type, "weapon_parry_bonus");
});


test("equipment modifier browser searches and displays groups instead of legacy tags and categories", () => {
  const browser = fs.readFileSync("module/apps/eqp-modifier-browser.js", "utf8");
  const template = fs.readFileSync("templates/apps/eqp-modifier-browser.hbs", "utf8");
  assert.match(browser, /item\.data\('group'\)/);
  assert.doesNotMatch(browser, /item\.data\('tags'\)/);
  assert.doesNotMatch(browser, /target_type/);
  assert.match(template, /data-group="{{this\.system\.group}}"/);
  assert.match(template, /class="item-group"/);
  assert.doesNotMatch(template, /category-filter|data-cat-/);
});
