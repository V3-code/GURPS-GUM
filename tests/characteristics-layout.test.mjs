import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync("templates/actors/characters.hbs", "utf8");
const styles = readFileSync("styles/styles.css", "utf8");
const actorSheet = readFileSync("module/actor/gurps-actor-sheet.js", "utf8");
const itemSheet = readFileSync("module/item/gurps-item-sheet.js", "utf8");
const itemTemplate = readFileSync("templates/items/item-sheet.hbs", "utf8");
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
  assert.doesNotMatch(characteristicTab, /characteristics-race-row|edit-race-name|raceName/);
});

test("characteristic group headers do not inherit the legacy red treatment", () => {
  assert.doesNotMatch(styles, /\.tab\[data-tab="characteristics"\] \.gum-unified-header\s*\{/);
  assert.match(styles, /\.characteristic-group > \.characteristic-group-summary\s*\{[^}]*background:\s*transparent !important;/s);
  assert.match(styles, /\.characteristic-group\[open\] > \.characteristic-group-summary\s*\{\s*background:\s*rgba\(255,255,255,0\.025\) !important;/);
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

test("item organization names are offered as optional group suggestions", () => {
  assert.match(actorSheet, /system: \{ group: String\(item\.system\?\.group \?\? ""\)\.trim\(\) \}/);
  assert.match(actorSheet, /buildItemCategoryGroupPlan\(organization, suggestionItems\)/);
  assert.match(actorSheet, /createGroupsFromItemCategories\(organization, suggestionItems, createId, selectedCategories\)/);
});

test("advantage and disadvantage sheets use a free-text organization field", () => {
  const details = itemTemplate.slice(
    itemTemplate.indexOf("ABA DETALHES: ITEM VANTAGENS E DESVANTAGENS"),
    itemTemplate.indexOf("C\u00e1lculo de Custo")
  );
  assert.match(details, /input type="text" name="system\.group"/);
  assert.match(details, /placeholder="Ex: Racial: Elfo, Poderes Ps\u00edquicos\.\.\."/);
  assert.doesNotMatch(details, /select name="system\.block_id"|characteristic_blocks/);
  assert.doesNotMatch(itemSheet, /context\.characteristic_blocks/);
  assert.equal(schema.Item.advantage.group, "");
  assert.equal(schema.Item.disadvantage.group, "");
});
