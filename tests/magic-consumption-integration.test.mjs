import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const sheet = fs.readFileSync(new URL("../templates/items/item-sheet.hbs", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../module/services/magic-consumption-service.mjs", import.meta.url), "utf8");
const itemSheet = fs.readFileSync(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8");
const itemStyles = fs.readFileSync(new URL("../styles/item-sheet.css", import.meta.url), "utf8");
const globalStyles = fs.readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const schema = JSON.parse(fs.readFileSync(new URL("../template.json", import.meta.url), "utf8"));

test("spell and power schemas persist independent consumption groups", () => {
  assert.deepEqual(schema.Item.spell.consumptionGroups, {});
  assert.deepEqual(schema.Item.power.consumptionGroups, {});
});

test("the item sheet exposes triggers, variable amounts, and alternative sources", () => {
  assert.match(sheet, /magicConsumptionEditor/);
  assert.match(sheet, /system\.consumptionGroups\.\{\{group\.id\}\}\.trigger/);
  assert.match(sheet, /system\.consumptionGroups\.\{\{group\.id\}\}\.variableAmount/);
  assert.match(sheet, /system\.consumptionGroups\.\{\{group\.id\}\}\.sources/);
  assert.match(sheet, /sources\.\{\{source\.id\}\}\.sourceKey/);
  assert.match(sheet, /value="attempt"/);
  assert.match(sheet, /value="success"/);
  assert.match(sheet, /value="failure"/);
});

test("only the primary spell or power roll enters the consumption flow", () => {
  assert.match(main, /\["spell", "power"\]\.includes\(sourceItem\.type\) && rollData\.type === sourceItem\.type/);
  assert.match(main, /applyMagicConsumptionTrigger\(magicConsumptionSession, actor, "attempt"\)/);
  assert.match(main, /applyMagicConsumptionTrigger\(magicConsumptionSession, actor, rollOutcome\)/);
});

test("consumption editor and confirmation dialog reuse the sheet visual components", () => {
  assert.match(sheet, /skill-dashboard-card skill-dashboard-field-card/);
  assert.match(sheet, /skill-dashboard-toggle-card/);
  assert.match(sheet, /skill-dashboard-card magic-consumption-source/);
  assert.match(service, /gum-popup-form gum-record-editor gum-magic-consumption-dialog/);
  assert.match(service, /gum-record-editor__intro form-group--full/);
  assert.match(service, /gum-record-editor__section gum-magic-consumption-dialog__group/);
  assert.match(service, /"gum-sheet-edit-dialog", "gum-record-edit-dialog", "gum-resource-edit-dialog"/);
});

test("consumption controls keep paired toggles, lock unnamed resources, and step variable amounts", () => {
  assert.match(itemStyles, /spell-power-dashboard \.magic-consumption-group__options\s*\{\s*grid-template-columns:\s*repeat\(2,/);
  assert.match(itemStyles, /magic-consumption-sources__header button,[\s\S]*?border:\s*0;/);
  assert.match(sheet, /class="magic-consumption-source-type"/);
  assert.match(sheet, /class="magic-consumption-source-name"[\s\S]*?\(eq source\.type "hp"\)[\s\S]*?\(eq source\.type "fp"\)[\s\S]*?disabled/);
  assert.match(itemSheet, /\["hp", "fp"\]\.includes\(sourceType\)/);
  assert.match(itemSheet, /magic-consumption-source-type[\s\S]*?updateMagicConsumptionSourceNameState/);
  assert.match(service, /class="gum-magic-consumption-step" data-direction="decrease"/);
  assert.match(service, /class="gum-magic-consumption-step" data-direction="increase"/);
  assert.match(service, /type="number" min="0" step="any"/);
  assert.match(service, /Math\.max\(0,/);
  assert.match(service, /Number\(amount\.toFixed\(6\)\)/);
  assert.match(service, /\.on\("change blur"/);
  assert.match(globalStyles, /gum-magic-consumption-dialog__group select option\s*\{[\s\S]*?background:\s*#f1eee7;[\s\S]*?color:\s*#211f1b;/);
});
