import test from "node:test";
import assert from "node:assert/strict";
import { buildEquipmentSortUpdates, resolveEquipmentDrop } from "../module/utils/equipment-drop.mjs";

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

test("reorders loose equipment at the requested drop position", () => {
  const items = [
    { id: "a", sort: 100000, system: { equipped: false, stored: false } },
    { id: "b", sort: 200000, system: { equipped: false, stored: false } },
    { id: "c", sort: 300000, system: { equipped: false, stored: false } }
  ];
  assert.deepEqual(buildEquipmentSortUpdates(items, {
    itemId: "c",
    targetZone: "carried",
    targetIndex: 1
  }), [
    { _id: "a", sort: 100000 },
    { _id: "c", sort: 200000 },
    { _id: "b", sort: 300000 }
  ]);
});

test("reorders equipment inside its destination container", () => {
  const items = [
    { id: "outside", sort: 100000, system: { parent_container_id: "" } },
    { id: "first", sort: 100000, system: { parent_container_id: "pack" } },
    { id: "moved", sort: 200000, system: { parent_container_id: "other" } },
    { id: "last", sort: 300000, system: { parent_container_id: "pack" } }
  ];
  assert.deepEqual(buildEquipmentSortUpdates(items, {
    itemId: "moved",
    targetZone: "container:pack",
    targetIndex: 1
  }), [
    { _id: "first", sort: 100000 },
    { _id: "moved", sort: 200000 },
    { _id: "last", sort: 300000 }
  ]);
});
