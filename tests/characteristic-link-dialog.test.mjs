import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const ptBr = JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

test("spell and power links share the compact trait picker", () => {
  assert.match(actorSheet, /async _promptCharacteristicLink\(linkType\)/);
  assert.match(actorSheet, /GUM\.Spells\.LinkAbilityDialogTitle/);
  assert.match(actorSheet, /GUM\.Powers\.LinkSourceDialogTitle/);
  assert.match(actorSheet, /characteristic-link-picker__intro/);
  assert.match(actorSheet, /characteristic-link-option__image/);
  assert.match(actorSheet, /classList\.toggle\("is-selected"/);
});

test("trait picker uses the current dark card treatment", () => {
  assert.match(styles, /gum-characteristic-link-dialog \.characteristic-link-option\s*\{[^}]*grid-template-columns: 14px 36px minmax\(0, 1fr\) auto;/s);
  assert.match(styles, /gum-characteristic-link-dialog \.characteristic-link-option\.is-selected\s*\{[^}]*box-shadow: inset 3px 0 #a892e3;/s);
  assert.match(styles, /gum-characteristic-link-dialog \.dialog-buttons button\[data-button="link"\]/);
  assert.doesNotMatch(styles, /characteristic-link-option\s*\{[\s\S]{0,300}border: 1px solid rgba\(92, 68, 45/);
});

test("trait picker copy is available in English and Portuguese", () => {
  for (const key of [
    "GUM.Characteristics.Link",
    "GUM.Characteristics.LinkDialogHint",
    "GUM.Characteristics.LinkDialogSearchLabel",
    "GUM.Characteristics.LinkDialogSearchPlaceholder",
    "GUM.Characteristics.LinkDialogNoResults",
    "GUM.Characteristics.LinkDialogEmpty",
    "GUM.Characteristics.LinkDialogSelectionRequired",
    "GUM.Spells.LinkAbilityDialogTitle",
    "GUM.Powers.LinkSourceDialogTitle"
  ]) {
    assert.equal(typeof en[key], "string");
    assert.equal(typeof ptBr[key], "string");
  }
});
