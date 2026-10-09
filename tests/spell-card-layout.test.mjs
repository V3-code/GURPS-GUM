import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const ptBr = JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

const spellTab = template.slice(template.indexOf('data-tab="spells"'), template.indexOf("ABA DE PODERES"));
const powerTab = template.slice(template.indexOf('data-tab="powers"'), template.indexOf("ABA DE COMBATE"));

test("spell cards use isolated compact markup while powers retain the legacy card", () => {
  assert.match(spellTab, /class="item-wrapper item magic-card/);
  assert.match(spellTab, /class="magic-card__main"/);
  assert.match(spellTab, /class="magic-card__details"/);
  assert.doesNotMatch(spellTab, /spell-row-v3|spell-card-two-line|spell-card-primary|spell-card-secondary|spell-list-v2/);
  assert.match(powerTab, /spell-row-v3 spell-card-two-line/);
});

test("collapsed spell cards form a responsive two-column grid", () => {
  assert.match(styles, /\.tab\[data-tab="spells"\] \.magic-card-grid\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/s);
  assert.match(styles, /\.tab\[data-tab="spells"\] \.magic-card__main\s*\{[^}]*grid-template-columns:28px minmax\(78px,1fr\)/s);
  assert.match(styles, /\.magic-card\.is-expanded\s*\{\s*grid-column:1 \/ -1;/s);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*\.magic-card-grid\s*\{\s*grid-template-columns:1fr;/s);
});

test("spell rows preserve rolls, quick view, item actions, and drag behavior", () => {
  assert.match(spellTab, /class="rollable magic-card__metric-value"/);
  assert.match(spellTab, /class="rollable-damage magic-card__metric-value"/);
  assert.match(spellTab, /magic-card__name item-quick-view/);
  assert.match(spellTab, /item-edit gum-action-menu__item/);
  assert.match(spellTab, /item-delete gum-action-menu__item is-danger/);
  assert.match(spellTab, /data-item-id="{{this\.id}}" draggable="true"/);
  assert.match(actorSheet, /html\.find\("\.magic-card"\)\.each/);
  assert.match(actorSheet, /card\.addEventListener\("dragstart"/);
  assert.match(actorSheet, /ev\.target\.closest\?\.\("\.rollable"\)/);
  assert.match(actorSheet, /this\._setCardDragImage\(ev, card, "\.magic-card__main"\)/);
});

test("mechanical details expand into attack, damage, and resolution branches", () => {
  assert.match(spellTab, /magic-card__expand/);
  assert.match(spellTab, /magic-card__detail-branch--attack/);
  assert.match(spellTab, /magic-card__detail-branch--damage/);
  assert.match(spellTab, /magic-card__detail-branch--resolution/);
  assert.match(actorSheet, /this\._expandedSpellCards \?\?= new Set\(\)/);
  assert.match(actorSheet, /html\.on\('click', '\.magic-card__expand'/);
  assert.match(actorSheet, /row\.find\('\.spell-name, \.magic-card__name'\)/);
  assert.match(actorSheet, /\.magic-card, \.meter-card/);
});

test("spell groups and card copy are localized in English and Portuguese", () => {
  for (const key of [
    "GUM.Spells.SearchPlaceholder",
    "GUM.Spells.Count",
    "GUM.Spells.Time",
    "GUM.Spells.Mana",
    "GUM.Spells.ExpandDetails",
    "GUM.Spells.Attack",
    "GUM.Spells.Damage",
    "GUM.Spells.Resolution"
  ]) {
    assert.match(spellTab, new RegExp(key.replaceAll(".", "\\.")));
    assert.equal(typeof ptBr[key], "string");
    assert.equal(typeof en[key], "string");
  }
});
