import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

test("spell and power reserves share the compact combat-record card model", () => {
  const spellSection = template.slice(template.indexOf("{{#each spellReserves}}"), template.indexOf("{{/each}}", template.indexOf("{{#each spellReserves}}")));
  const powerSection = template.slice(template.indexOf("{{#each powerReserves}}"), template.indexOf("{{/each}}", template.indexOf("{{#each powerReserves}}")));

  for (const section of [spellSection, powerSection]) {
    assert.match(section, /energy-reserve-card-header[\s\S]+energy-reserve-name/);
    assert.match(section, /adjust-energy-reserve energy-reserve-adjust[^>]+data-adjustment="-1"/);
    assert.match(section, /adjust-energy-reserve energy-reserve-adjust[^>]+data-adjustment="1"/);
    assert.match(section, /máx\. <strong>{{this\.max}}<\/strong>/);
    assert.match(section, /edit-energy-reserve gum-action-menu__item/);
    assert.match(section, /delete-energy-reserve gum-action-menu__item is-danger/);
    assert.doesNotMatch(section, /meter-inputs/);
  }

  assert.match(spellSection, /energy-reserve-card--spell[\s\S]+fa-magic/);
  assert.match(powerSection, /energy-reserve-card--power[\s\S]+fa-bolt/);
  assert.match(styles, /\.energy-reserves-list \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("reserve buttons update current and legacy value within zero and maximum", () => {
  const listenerSection = actorSheet.slice(actorSheet.indexOf("RESERVAS DE ENERGIA"), actorSheet.indexOf("HABILIDADES DE CONJURAÇÃO"));
  const adjustHandler = actorSheet.slice(actorSheet.indexOf("async _onAdjustEnergyReserve"), actorSheet.indexOf("async _promptEnergyReserveData"));

  assert.match(listenerSection, /click", "\.adjust-energy-reserve"/);
  assert.match(adjustHandler, /reserve\.current \?\? reserve\.value \?\? 0/);
  assert.match(adjustHandler, /Math\.max\(0, Math\.min\(max, current \+ adjustment\)\)/);
  assert.match(adjustHandler, /`\$\{pathBase\}\.current`/);
  assert.match(adjustHandler, /`\$\{pathBase\}\.value`/);
});