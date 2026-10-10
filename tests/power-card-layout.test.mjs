import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const ptBr = JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

const powerTab = template.slice(template.indexOf('data-tab="powers"'), template.indexOf("ABA DE EQUIPAMENTOS"));

test("power cards use the same compact three-line layout as spell cards", () => {
  assert.match(powerTab, /class="item-wrapper item magic-card power-card/);
  assert.match(powerTab, /magic-card__identity-meta">\{\{this\.powerCardIdentity\}\}/);
  assert.match(powerTab, /magic-card__identity-mechanics[\s\S]*GUM\.Powers\.Time[\s\S]*GUM\.Powers\.Cost/);
  assert.match(powerTab, /magic-card__metric magic-card__nh/);
  assert.match(powerTab, /magic-card__metric magic-card__damage/);
  assert.doesNotMatch(powerTab, /spell-row-v3|spell-card-two-line|spell-card-primary|spell-card-secondary|spell-list-v2/);
  assert.match(styles, /:is\(\.tab\[data-tab="spells"\], \.tab\[data-tab="powers"\]\) \.magic-card/);
});

test("power cards preserve rolls, damage details, item actions, and drag behavior", () => {
  assert.match(powerTab, /data-type="power"/);
  assert.match(powerTab, /rollable magic-card__attack-level-tag/);
  assert.match(powerTab, /rollable-damage magic-card__metric-value/);
  assert.match(powerTab, /magic-card__additional-damage/);
  assert.match(powerTab, /item-quick-view gum-action-menu__item/);
  assert.match(powerTab, /item-edit gum-action-menu__item/);
  assert.match(powerTab, /item-delete gum-action-menu__item is-danger/);
  assert.match(powerTab, /data-item-id="{{this\.id}}" draggable="true"/);
  assert.match(actorSheet, /html\.find\("\.magic-card"\)\.each/);
});

test("every power card expands into full mechanics and optional detail branches", () => {
  assert.match(powerTab, /powerCardExpanded/);
  assert.match(powerTab, /magic-card__detail-branch--mechanics/);
  assert.match(powerTab, /GUM\.Powers\.ActivationTime[\s\S]*GUM\.Powers\.Duration[\s\S]*GUM\.Powers\.ActivationCost[\s\S]*GUM\.Powers\.MaintenanceCost/);
  assert.match(powerTab, /magic-card__detail-branch--attack/);
  assert.match(powerTab, /magic-card__detail-branch--damage/);
  assert.match(powerTab, /magic-card__detail-branch--resolution/);
  assert.match(actorSheet, /this\._expandedPowerCards \?\?= new Set\(\)/);
  assert.match(actorSheet, /card\.classList\.contains\('power-card'\)/);
  assert.match(actorSheet, /this\._expandedPowerCards \?\?= new Set\(\)/);
});

test("power toolbar, groups, cards, and search are localized in English and Portuguese", () => {
  for (const key of [
    "GUM.Powers.SearchPlaceholder",
    "GUM.Powers.Add",
    "GUM.Powers.Count",
    "GUM.Powers.Empty",
    "GUM.Powers.NoSearchResults",
    "GUM.Powers.View",
    "GUM.Powers.Options",
    "GUM.Powers.Edit",
    "GUM.Powers.Delete",
    "GUM.Powers.Time",
    "GUM.Powers.Cost",
    "GUM.Powers.Mechanics",
    "GUM.Powers.ActivationTime",
    "GUM.Powers.Duration",
    "GUM.Powers.ActivationCost",
    "GUM.Powers.MaintenanceCost",
    "GUM.Powers.ExpandDetails",
    "GUM.Powers.Configuration",
    "GUM.Powers.Points"
  ]) {
    assert.match(powerTab, new RegExp(key.replaceAll(".", "\\.")));
    assert.equal(typeof ptBr[key], "string");
    assert.equal(typeof en[key], "string");
  }
  assert.match(actorSheet, /\.power-search-empty/);
});
