import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const ptBr = JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

const conditionsTab = template.slice(template.indexOf('class="tab conditions-tab"'), template.indexOf('class="custom-context-menu"'));

test("condition sections use neutral compact headers and cards", () => {
  assert.match(styles, /\.conditions-tab details\.form-section\.gum-unified-section > \.gum-unified-header\s*\{[^}]*background:\s*transparent !important;/s);
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced\s*\{[^}]*background:\s*#1a1b1f;[^}]*border-left:\s*2px solid/s);
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced \.pill-icon\s*\{[^}]*width:\s*28px;/s);
});

test("conditions tab localizes headings, states, controls, and generated origins", () => {
  assert.match(conditionsTab, /GUM\.Conditions\.TemporaryEffects/);
  assert.match(conditionsTab, /GUM\.Conditions\.PermanentEffects/);
  assert.match(conditionsTab, /GUM\.Conditions\.PassiveRules/);
  assert.match(conditionsTab, /GUM\.Conditions\.ToggleEffect/);
  assert.match(conditionsTab, /GUM\.Conditions\.NoTemporaryEffects/);
  assert.match(actorSheet, /GUM\.Conditions\.Source\.Advantages/);
  assert.match(actorSheet, /GUM\.Conditions\.Duration\.Permanent/);
});

test("localization keys do not collide with their own nested namespaces", () => {
  for (const locale of [ptBr, en]) {
    const keys = Object.keys(locale);
    const conflicts = keys.filter(key => keys.some(candidate => candidate.startsWith(`${key}.`)));
    assert.deepEqual(conflicts, []);
  }
});
