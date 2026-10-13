import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  equipmentIntegrityCurrentUpdate,
  equipmentIntegrityRecord
} from "../module/utils/equipment-resolution.mjs";

function equipment(system = {}) {
  const sourceSystem = {
    quantity: 1,
    item_hp: 12,
    item_hp_current: 8,
    item_dr: 3,
    integrity_record_enabled: true,
    ...system
  };
  return { id: "shield", type: "equipment", name: "Escudo", _source: { system: sourceSystem }, system: sourceSystem };
}

test("exposes enabled equipment integrity as an independent linked record", () => {
  const record = equipmentIntegrityRecord(equipment());
  assert.deepEqual(record, {
    equipmentId: "shield",
    recordType: "integrity",
    name: "Escudo",
    source: "Escudo",
    current: 8,
    max: 12,
    value: 8,
    dr: 3
  });
  assert.equal(equipmentIntegrityRecord(equipment({ integrity_record_enabled: false })), null);
});

test("integrity updates clamp only item HP current and never touch charges", () => {
  const item = equipment({ item_hp_current: 8, current_uses: 4, max_uses: 9 });
  assert.deepEqual(equipmentIntegrityCurrentUpdate(item, -3), { "system.item_hp_current": 0 });
  assert.deepEqual(equipmentIntegrityCurrentUpdate(item, 99), { "system.item_hp_current": 12 });
  assert.equal(Object.hasOwn(equipmentIntegrityCurrentUpdate(item, 5), "system.current_uses"), false);
});

test("equipment sheet and damage flow expose the linked integrity record", () => {
  const template = fs.readFileSync(new URL("../templates/items/item-sheet.hbs", import.meta.url), "utf8");
  const actorSheet = fs.readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
  const damageApplication = fs.readFileSync(new URL("../scripts/apps/damage-application.js", import.meta.url), "utf8");
  const schema = JSON.parse(fs.readFileSync(new URL("../template.json", import.meta.url), "utf8"));

  assert.equal(schema.Item.templates.equipment_base.item_hp_current, 0);
  assert.equal(schema.Item.templates.equipment_base.integrity_record_enabled, false);
  assert.match(template, /system\.item_hp_current/);
  assert.match(template, /system\.integrity_record_enabled/);
  assert.match(actorSheet, /equipmentIntegrityRecord/);
  assert.match(actorSheet, /_adjustEquipmentIntegrity/);
  assert.match(damageApplication, /equipment-integrity:/);
  assert.match(damageApplication, /equipmentIntegrityCurrentUpdate/);
});
