import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const schema = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));

test("magias e poderes possuem organizações visuais independentes", () => {
  for (const type of ["spell", "power"]) {
    assert.deepEqual(schema.Actor.character[`${type}_organization`], {
      groups: {}, groupOrder: [], assignments: {}, itemOrder: {}
    });
    assert.match(actorSheet, new RegExp(`system\\.${type}_organization`));
    assert.match(template, new RegExp(`data-ability-type="${type}"`));
    assert.match(template, new RegExp(`data-organizer-item-type="${type}"`));
  }
  assert.match(template, /{{#each spellSections as \|section\|}}/);
  assert.match(template, /{{#each powerSections as \|section\|}}/);
  assert.match(actorSheet, /namespace: `\$\{type\}s`/);
});

test("organização visual não atualiza o grupo interno dos itens", () => {
  const organizationBlock = actorSheet.slice(
    actorSheet.indexOf("_getAbilityOrganizationState(type)"),
    actorSheet.indexOf("_getCharacteristicOrganizationState()")
  );
  assert.match(organizationBlock, /moveOrganizedItem|_saveAbilityOrganization/);
  assert.doesNotMatch(organizationBlock, /system\.group/);
});
