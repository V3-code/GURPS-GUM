import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  applyEquipmentDefenseBonus,
  collectActiveEquipmentDefenseBonuses,
  evaluateDecisiveDefenseBonus,
  totalActiveEquipmentDefenseBonus
} from "../module/utils/equipment-defense-bonus.mjs";

const equipment = (id, name, system) => ({ id, name, type: "equipment", _source: { system } });
const main = fs.readFileSync("scripts/main.js", "utf8");
const actorSheet = fs.readFileSync("module/actor/gurps-actor-sheet.js", "utf8");
const actorTemplate = fs.readFileSync("templates/actors/characters.hbs", "utf8");

test("collects only equipped equipment with an explicitly active Defense Bonus", () => {
  const items = [
    equipment("shield", "Shield", { location: "equipped", defense_bonus: 2, defense_bonus_active: true }),
    equipment("bracer", "Bracer", { equipped: true, defense_bonus: 1, defense_bonus_active: true }),
    equipment("pack", "Pack", { location: "carried", defense_bonus: 4, defense_bonus_active: true }),
    equipment("off", "Off-hand item", { location: "equipped", defense_bonus: 3, defense_bonus_active: false }),
    equipment("modifier", "Enchanted shield", {
      location: "equipped", defense_bonus: 0, defense_bonus_active: true,
      eqp_modifiers: { ward: { id: "ward", features_data: { bonus: { id: "bonus", type: "equipment_property", path: "defense_bonus", operation: "add", value: 2 } } } }
    })
  ];
  assert.deepEqual(collectActiveEquipmentDefenseBonuses(items), [
    { itemId: "shield", name: "Shield", bonus: 2 },
    { itemId: "bracer", name: "Bracer", bonus: 1 },
    { itemId: "modifier", name: "Enchanted shield", bonus: 2 }
  ]);
  assert.equal(totalActiveEquipmentDefenseBonus(items), 5);
});

test("marks only ordinary defense outcomes crossed by an active Defense Bonus", () => {
  assert.deepEqual(evaluateDecisiveDefenseBonus({ rollTotal: 12, uncappedTarget: 12, defenseBonus: 2 }), {
    outcome: "success", bonus: 2, finalTarget: 12, targetWithoutBonus: 10
  });
  assert.deepEqual(evaluateDecisiveDefenseBonus({ rollTotal: 13, uncappedTarget: 12, defenseBonus: -2 }), {
    outcome: "failure", bonus: -2, finalTarget: 12, targetWithoutBonus: 14
  });
  assert.equal(evaluateDecisiveDefenseBonus({ rollTotal: 10, uncappedTarget: 12, defenseBonus: 2 }), null);
  assert.equal(evaluateDecisiveDefenseBonus({ rollTotal: 3, uncappedTarget: 12, defenseBonus: 2 }), null);
  assert.equal(evaluateDecisiveDefenseBonus({ rollTotal: 12, uncappedTarget: 14, cap: 12, defenseBonus: 2 }), null);
});

test("adds equipment Defense Bonus after existing defense values and preserves suffixes", () => {
  assert.equal(applyEquipmentDefenseBonus(10, 2), 12);
  assert.equal(applyEquipmentDefenseBonus("11F", 2), "13F");
  assert.equal(applyEquipmentDefenseBonus("9U", -1), "8U");
  assert.equal(applyEquipmentDefenseBonus("—", 2), "—");
});

test("actor defense displays and inventory cards share the active equipment toggle", () => {
  assert.match(main, /attributes\.dodge\.final = applyEquipmentDefenseBonus/);
  assert.match(main, /return applyEquipmentDefenseBonus\(`\$\{baseValue \+ defenseNhBonuses\.passive \+ defenseNhBonuses\.temp\}/);
  assert.match(actorTemplate, /data-defense-bonus-included="true"/);
  assert.match(actorTemplate, /item-toggle-defense-bonus/);
  assert.match(actorSheet, /system\.defense_bonus_active/);
  assert.match(actorSheet, /defenseBonusIncluded: dataset\.defenseBonusIncluded === "true"/);
});
