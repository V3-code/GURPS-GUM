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
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\);[^}]*background:\s*#1a1b1f;[^}]*border:\s*0;[^}]*box-shadow:\s*inset 2px 0 0 rgba\(225,184,117,\.42\);/s);
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced \.pill-icon\s*\{[^}]*width:\s*28px;/s);
  assert.match(styles, /\.conditions-tab \.gum-unified-section \.effect-pill-enhanced \.pill-controls\s*\{[^}]*flex-direction:\s*row;[^}]*border-top:\s*1px solid/s);
  assert.match(styles, /\.conditions-tab \.gum-action-menu__panel\s*\{[^}]*background:\s*#f6f4f0;/s);
  assert.doesNotMatch(styles, /\.gum-unified-section \.effect-pill-enhanced\s*\{[^}]*background:\s*#2f343d;/s);
  assert.match(styles, /\.conditions-tab \.effect-origin-summary\s*\{[^}]*border-bottom:\s*1px solid rgba\(197,160,91,\.2\);[^}]*background:\s*transparent !important;/s);
  assert.match(styles, /\.conditions-tab \.effect-origin-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);/s);
  assert.match(styles, /\.conditions-tab \.effects-grid-container\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);/s);
  assert.match(styles, /\.conditions-tab \.effect-origin-group\s*\{[^}]*grid-column:\s*1 \/ -1;/s);
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced \.pill-card-visual\s*\{[^}]*flex-direction:\s*column;/s);
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced \.pill-name\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/s);
});

test("all condition card types keep their controls in the shared footer menu", () => {
  assert.equal((conditionsTab.match(/class="pill-card-content"/g) ?? []).length, 3);
  assert.equal((conditionsTab.match(/class="gum-action-menu js-action-menu"/g) ?? []).length, 3);
  assert.equal((conditionsTab.match(/class="effect-toggle"/g) ?? []).length, 2);
  assert.equal((conditionsTab.match(/quick-view-origin/g) ?? []).length, 2);
  assert.equal((conditionsTab.match(/data-action="delete-effect"/g) ?? []).length, 2);
  assert.match(conditionsTab, /class="manual-override-toggle"/);
  assert.equal((conditionsTab.match(/class="pill-card-visual"/g) ?? []).length, 3);
  assert.match(conditionsTab, /pill-card-visual">\s*<img src="\{\{effect\.img\}\}"[\s\S]*?<div class="pill-switch-wrapper"/);
  assert.match(conditionsTab, /pill-card-visual">\s*<img src="\{\{item\.img\}\}"[\s\S]*?<div class="pill-switch-wrapper"/);
  assert.match(conditionsTab, /item-control item-edit gum-action-menu__item/);
  assert.match(conditionsTab, /item-control item-delete gum-action-menu__item is-danger/);
});

test("condition cards rise above neighboring cards while their action menu is open", () => {
  assert.match(actorSheet, /menu\.closest\("\.skill-tree-item, \.characteristic-card, \.spell-row-v3, \.meter-card, \.effect-pill-enhanced"\)/);
  assert.match(actorSheet, /\.effect-pill-enhanced\.action-menu-open-row/);
  assert.match(styles, /\.conditions-tab \.effect-pill-enhanced\.action-menu-open-row\s*\{[^}]*z-index:\s*120;/s);
});

test("conditions tab localizes headings, states, controls, and generated origins", () => {
  assert.match(conditionsTab, /GUM\.Conditions\.TemporaryEffects/);
  assert.match(conditionsTab, /GUM\.Conditions\.PermanentEffects/);
  assert.match(conditionsTab, /GUM\.Conditions\.PassiveRules/);
  assert.match(conditionsTab, /GUM\.Conditions\.ToggleEffect/);
  assert.match(conditionsTab, /GUM\.Conditions\.NoTemporaryEffects/);
  assert.match(actorSheet, /GUM\.Conditions\.Source\.Advantages/);
  assert.match(actorSheet, /GUM\.Conditions\.Duration\.Permanent/);
  assert.match(actorSheet, /game\.i18n\.localize\(isDisabled \? 'GUM\.Conditions\.Disabled' : 'GUM\.Conditions\.Automatic'\)/);
  assert.match(actorSheet, /game\.i18n\.localize\(isDisabled \? 'GUM\.Conditions\.Disabled' : 'GUM\.Conditions\.Active'\)/);
});

test("localization keys do not collide with their own nested namespaces", () => {
  for (const locale of [ptBr, en]) {
    const keys = Object.keys(locale);
    const conflicts = keys.filter(key => keys.some(candidate => candidate.startsWith(`${key}.`)));
    assert.deepEqual(conflicts, []);
  }
});
