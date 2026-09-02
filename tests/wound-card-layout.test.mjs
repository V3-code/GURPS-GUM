import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

test("combat tab separates operational controls from offensive actions", () => {
  assert.match(template, /combat-area-label[^>]*>[^<]*<span>Controle de Combate<\/span>/);
  assert.match(template, /combat-area-label[^>]*>[^<]*<span>Ações de Combate<\/span>/);
  assert.match(template, /combat-actions-list/);
});

test("wound cards expose compact accessible controls and a discreet action menu", () => {
  const woundSection = template.slice(template.indexOf('class="group-content wound-list"'), template.indexOf("{{else}}", template.indexOf('class="group-content wound-list"')));

  assert.match(woundSection, /wound-nature-icon[^>]+title="{{this\.natureTooltip}}"[^>]+aria-label="{{this\.natureTooltip}}"/);
  assert.match(woundSection, /adjust-wound wound-adjust[^>]+data-adjustment="-1"/);
  assert.match(woundSection, /adjust-wound wound-adjust[^>]+data-adjustment="1"/);
  assert.match(woundSection, /class="wound-grid"/);
  assert.match(woundSection, /title="{{this\.woundTooltip}}" aria-label="Ferimento: {{this\.woundTooltip}}"/);
  assert.match(woundSection, /class="wound-value-controls"/);
  assert.match(woundSection, /js-action-menu-toggle/);
  assert.match(woundSection, /edit-wound gum-action-menu__item/);
  assert.match(woundSection, /delete-wound gum-action-menu__item is-danger/);
  assert.doesNotMatch(woundSection, /wound-card-meta|originDisplay|locationDisplay/);
  assert.doesNotMatch(woundSection, /wound-card-tags|{{this\.value}}\s*\//);
  assert.match(actorSheet, /Natureza: \$\{natureDisplay\}/);
  assert.match(actorSheet, /Destino: \$\{wound\.poolLabel\}/);
  assert.match(actorSheet, /Origem: \$\{originDisplay\}/);
  assert.match(actorSheet, /Local: \$\{locationDisplay\}/);
  assert.match(actorSheet, /Observações: \$\{wound\.notes\}/);
  assert.match(actorSheet, /woundTooltip: tooltipLines\.join\("\\n"\)/);
});

test("wound adjustment preserves the card at zero and legacy values remain compatible", () => {
  const adjustHandler = actorSheet.slice(actorSheet.indexOf("async _onAdjustWound"), actorSheet.indexOf("async _onToggleCombatMeterVisibility"));

  assert.match(actorSheet, /wound\.remaining \?\? wound\.value \?\? 0/);
  assert.match(actorSheet, /Math\.max\(0, currentRemaining \+ adjustment\)/);
  assert.match(actorSheet, /system\.combat\.wounds\.\$\{woundId\}\.remaining/);
  assert.doesNotMatch(adjustHandler, /-=|updatedAt/);
  assert.match(styles, /\.wound-grid \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.wound-list \{ display:block;/);
  assert.match(styles, /\.wound-card \{[^}]*display:grid; grid-template-columns:28px minmax\(0,1fr\) 28px;/);
  assert.match(styles, /\.wound-value-controls \{[^}]*justify-self:center;/);
  assert.match(styles, /max-width:900px[^}]+\.wound-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});