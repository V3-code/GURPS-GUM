import test from "node:test";
import assert from "node:assert/strict";
import { ORGANIZER_DRAG_TYPE, readOrganizerDragData } from "../module/services/sheet-item-organizer.mjs";

const transfer = values => ({ getData: type => values[type] ?? "" });

test("reads the namespaced organizer payload without claiming Foundry item drops", () => {
  const payload = { type: ORGANIZER_DRAG_TYPE, actorUuid: "Actor.x", namespace: "skills", itemId: "a" };
  assert.deepEqual(readOrganizerDragData(transfer({ "application/x-gum-item-organizer": JSON.stringify(payload) })), payload);
  assert.equal(readOrganizerDragData(transfer({ "text/plain": JSON.stringify({ type: "Item", uuid: "Item.x" }) })), null);
  assert.equal(readOrganizerDragData(transfer({ "text/plain": "not-json" })), null);
});
