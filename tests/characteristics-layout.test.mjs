import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync("templates/actors/characters.hbs", "utf8");
const styles = readFileSync("styles/styles.css", "utf8");
const actorSheet = readFileSync("module/actor/gurps-actor-sheet.js", "utf8");
const schema = JSON.parse(readFileSync("template.json", "utf8"));
const characteristicTab = template.slice(
  template.indexOf('class="tab characteristics-tab"'),
  template.indexOf("ABA DE PERÍCIAS")
);

test("characteristics use an ungrouped-first hybrid organization", () => {
  assert.match(actorSheet, /context\.characteristicSections = \[\{/);
  assert.match(actorSheet, /name: "Vantagens e Desvantagens"/);
  assert.match(actorSheet, /isUngrouped: true/);
  assert.match(actorSheet, /\.\.\.characteristicOrganization\.groupOrder\.map/);
  assert.match(characteristicTab, /{{#each characteristicSections as \|section\|}}/);
  assert.doesNotMatch(characteristicTab, /char-section-block[1-4]/);
});

test("characteristic cards render two per row and collapse to one on narrow sheets", () => {
  assert.match(styles, /\.characteristic-group-content\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /@media \(max-width:\s*680px\)[\s\S]*\.characteristic-group-content\s*\{\s*grid-template-columns:\s*1fr;/);
});

test("characteristic groups expose complete organizer controls", () => {
  assert.match(characteristicTab, /characteristic-search-input/);
  assert.match(characteristicTab, /create-characteristic-group/);
  assert.match(characteristicTab, /suggest-characteristic-groups/);
  assert.match(characteristicTab, /rename-characteristic-group/);
  assert.match(characteristicTab, /delete-characteristic-group/);
  assert.match(characteristicTab, /remove-characteristic-from-group/);
  assert.match(characteristicTab, /data-organizer-zone/);
  assert.match(characteristicTab, /data-organizer-item-id="{{this\.id}}"/);
  assert.match(characteristicTab, /characteristic-group-count/);
});

test("characteristic organization persists independently in the actor schema", () => {
  assert.deepEqual(schema.Actor.character.characteristic_organization, {
    groups: {}, groupOrder: [], assignments: {}, itemOrder: {}
  });
  assert.match(actorSheet, /system\.characteristic_organization\.groups/);
  assert.match(actorSheet, /namespace: 'characteristics'/);
  assert.match(actorSheet, /acceptedItemTypes: \['advantage', 'disadvantage'\]/);
});

test("characteristic search filters rich card text and restores expansion", () => {
  assert.match(characteristicTab, /data-search="{{this\.name}}[\s\S]*{{this\.characteristicKindLabel}}/);
  assert.match(actorSheet, /find\('\.characteristic-search-input'\)\.on\('input'/);
  assert.match(actorSheet, /characteristicSearchWasOpen/);
  assert.match(actorSheet, /characteristics-search-empty/);
});

test("legacy characteristic blocks are offered as optional group suggestions", () => {
  assert.match(actorSheet, /block1: "Raciais"/);
  assert.match(actorSheet, /block2: "Vantagens"/);
  assert.match(actorSheet, /block3: "Desvantagens"/);
  assert.match(actorSheet, /block4: "Especiais"/);
  assert.match(actorSheet, /buildItemCategoryGroupPlan\(organization, suggestionItems\)/);
  assert.match(actorSheet, /createGroupsFromItemCategories\(organization, suggestionItems, createId, selectedCategories\)/);
});
