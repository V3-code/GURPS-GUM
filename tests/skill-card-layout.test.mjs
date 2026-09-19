import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

const skillTab = template.slice(template.indexOf('class="tab skills-tab"'), template.indexOf("ABA DE CONJURAÇÕES"));

test("skill groups use a full-width responsive two-column card grid", () => {
  assert.match(styles, /\.skills-scroll-area\.group\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.match(styles, /\.skills-scroll-area\.group \.skill-tree-list\.group-content\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width:\s*680px\)[\s\S]*grid-template-columns:\s*1fr/);
});

test("the group view exposes hybrid organization without deriving visual groups in the template", () => {
  assert.match(skillTab, /{{#each skillSections as \|section\|}}/);
  assert.match(skillTab, /data-organizer-zone/);
  assert.match(skillTab, /data-organizer-item-id="{{this\._id}}"/);
  assert.match(skillTab, /create-skill-group/);
  assert.match(skillTab, /rename-skill-group/);
  assert.match(skillTab, /delete-skill-group/);
  assert.match(skillTab, /remove-skill-from-group/);
  assert.match(skillTab, /collapsibleState \(concat "skill-" section\.id\)/);
  assert.doesNotMatch(skillTab, /{{#unless section\.isTree}}open/);
  assert.match(styles, /\.is-manual-organization > \.skill-tree-summary/);
  assert.match(styles, /\.skill-category-preview__row/);
});

test("skill cards expose compact mechanics and a dedicated control footer", () => {
  assert.match(actorSheet, /points:\s*useTreeFields\s*\?/);
  assert.match(skillTab, /title="Pontos investidos">\{\{this\.skillListDisplay\.points\}\} pts/);
  assert.match(skillTab, /<div class="item-controls st-controls">[\s\S]*skill-modifier-indicators[\s\S]*st-control-actions/);
  assert.doesNotMatch(skillTab, /gum-action-menu__toggle/);
  assert.match(styles, /\.st-controls\s*\{[^}]*border-top:[^}]*opacity:\s*1;/s);
});

test("skill modifier tags use restrained translucent treatments", () => {
  assert.match(styles, /\.skill-modifier-tag\s*\{[^}]*font-size:\s*9px;[^}]*\}/s);
  assert.match(styles, /\.skill-modifier-tag\.is-included\s*\{[^}]*background:\s*rgba\([^)]*,\s*0\.06\)/s);
  assert.match(styles, /\.skill-modifier-tag\.is-roll\.is-positive\s*\{[^}]*background:\s*rgba\([^)]*,\s*0\.06\)/s);
  assert.match(styles, /\.skill-modifier-tag\.is-roll\.is-negative\s*\{[^}]*background:\s*rgba\([^)]*,\s*0\.06\)/s);
});
