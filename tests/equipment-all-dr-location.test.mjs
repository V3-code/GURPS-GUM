import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const itemSheet = readFileSync(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8");
const english = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
const portuguese = JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));

test("equipped all-location DR applies to every active character location", () => {
  assert.match(main, /if \(loc === "all"\) \{[\s\S]*?for \(const key of locationKeys\) mergeDamageResistance\(drFromArmor\[key\], drObject\)/);
  assert.match(main, /if \(!locationKeySet\.has\(loc\)\) continue;/);
});

test("equipment protection exposes and normalizes the all-location path", () => {
  assert.match(itemSheet, /id: "all",[\s\S]*?GUM\.Equipment\.Protection\.AllLocations/);
  assert.match(itemSheet, /\["all", "todos", allLocationsLabel\]\.includes\(normalizedLabel\)/);
  for (const locale of [english, portuguese]) {
    assert.equal(typeof locale["GUM.Equipment.Protection.AllLocations"], "string");
    assert.equal(typeof locale["GUM.Equipment.Protection.ProvidesLocation"], "string");
    assert.equal(typeof locale["GUM.Combat.DR.LocationSearchHint"], "string");
  }
});

test("equipment protection can explicitly provide a missing body location", () => {
  assert.match(itemSheet, /dr_location_options/);
  assert.match(itemSheet, /provides_location/);
  assert.match(itemSheet, /dr-location-provides/);
  assert.match(itemSheet, /normalize\("NFD"\)/);
});
