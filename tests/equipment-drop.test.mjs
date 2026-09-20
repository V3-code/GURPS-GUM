import test from "node:test";
import assert from "node:assert/strict";
import { resolveEquipmentDrop } from "../module/utils/equipment-drop.mjs";

const item = { id: "item", system: { is_container: false } };

test("moves equipment into a container and inherits its location", () => {
  const container = { id: "pack", system: { equipped: false, stored: false } };
  assert.deepEqual(resolveEquipmentDrop(item, "container:pack", { container }), {
    _id: "item",
    "system.parent_container_id": "pack",
    "system.location": "carried",
    "system.equipped": false,
    "system.stored": false
  });
});

test("moves equipment out of containers into a location", () => {
  assert.deepEqual(resolveEquipmentDrop(item, "stored"), {
    _id: "item",
    "system.parent_container_id": "",
    "system.location": "stored",
    "system.equipped": false,
    "system.stored": true
  });
});

test("does not nest containers or accept unknown zones", () => {
  const containerItem = { id: "bag", system: { is_container: true } };
  const target = { id: "chest", system: { stored: true } };
  assert.equal(resolveEquipmentDrop(containerItem, "container:chest", { container: target }), null);
  assert.equal(resolveEquipmentDrop(item, "somewhere"), null);
});
