import test from "node:test";
import assert from "node:assert/strict";
import { ORGANIZER_DRAG_TYPE, readOrganizerDragData } from "../module/services/sheet-item-organizer.mjs";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../module/services/sheet-item-organizer.mjs", import.meta.url), "utf8");

const transfer = values => ({ getData: type => values[type] ?? "" });

test("reads the namespaced organizer payload without claiming Foundry item drops", () => {
  const payload = { type: ORGANIZER_DRAG_TYPE, actorUuid: "Actor.x", namespace: "skills", itemId: "a" };
  assert.deepEqual(readOrganizerDragData(transfer({ "application/x-gum-item-organizer": JSON.stringify(payload) })), payload);
  assert.equal(readOrganizerDragData(transfer({ "text/plain": JSON.stringify({ type: "Item", uuid: "Item.x" }) })), null);
  assert.equal(readOrganizerDragData(transfer({ "text/plain": "not-json" })), null);
});

test("captures organizer drops before Foundry's generic sheet drop handler", () => {
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /addEventListener\("drop", onDrop, true\)/);
  assert.match(source, /removeEventListener\("drop", onDrop, true\)/);
});

test("treats dropping an organizer item on itself as a no-op", () => {
  assert.match(source, /organizerItemId === draggedItemId\) return null/);
  assert.match(source, /if \(targetIndex === null\) return/);
});

test("calculates positions only from items owned by the active nested zone", () => {
  assert.match(source, /entry\.closest\(zoneSelector\) === zone/);
  assert.match(source, /getTargetIndex\(zone, event, itemSelector, zoneSelector, data\.itemId\)/);
});
