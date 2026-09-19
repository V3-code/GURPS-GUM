import test from "node:test";
import assert from "node:assert/strict";
import {
  UNGROUPED_ORGANIZER_ID,
  addItemOrganizationGroup,
  createGroupsFromItemCategories,
  moveOrganizedItem,
  normalizeItemOrganization,
  removeItemOrganizationGroup,
  renameItemOrganizationGroup
} from "../module/utils/item-organization.mjs";

const itemIds = ["a", "b", "c"];

test("normalizes stale organization data and keeps new items ungrouped", () => {
  const result = normalizeItemOrganization({
    groups: { combat: { name: "Combate" }, empty: { name: "" } },
    groupOrder: ["missing", "combat"],
    assignments: { a: "combat", b: "missing", stale: "combat" },
    itemOrder: { combat: ["stale", "a"], [UNGROUPED_ORGANIZER_ID]: ["b"] }
  }, itemIds);

  assert.deepEqual(result.groupOrder, ["combat"]);
  assert.deepEqual(result.assignments, { a: "combat" });
  assert.deepEqual(result.itemOrder.combat, ["a"]);
  assert.deepEqual(result.itemOrder[UNGROUPED_ORGANIZER_ID], ["b", "c"]);
});

test("creates, renames and removes groups without deleting their items", () => {
  let state = addItemOrganizationGroup({}, { id: "combat", name: "Combate" }, itemIds);
  state = moveOrganizedItem(state, { itemId: "a", targetGroupId: "combat", targetIndex: 0 }, itemIds);
  state = renameItemOrganizationGroup(state, { id: "combat", name: "Ação" }, itemIds);
  assert.equal(state.groups.combat.name, "Ação");
  assert.equal(state.assignments.a, "combat");

  state = removeItemOrganizationGroup(state, "combat", itemIds);
  assert.equal(state.groups.combat, undefined);
  assert.equal(state.assignments.a, undefined);
  assert.deepEqual(state.itemOrder[UNGROUPED_ORGANIZER_ID], ["b", "c", "a"]);
});

test("moves items between and within buckets using a stable target index", () => {
  let state = addItemOrganizationGroup({}, { id: "combat", name: "Combate" }, itemIds);
  state = moveOrganizedItem(state, { itemId: "a", targetGroupId: "combat" }, itemIds);
  state = moveOrganizedItem(state, { itemId: "b", targetGroupId: "combat", targetIndex: 0 }, itemIds);
  assert.deepEqual(state.itemOrder.combat, ["b", "a"]);

  state = moveOrganizedItem(state, { itemId: "b", targetGroupId: UNGROUPED_ORGANIZER_ID, targetIndex: 1 }, itemIds);
  assert.deepEqual(state.itemOrder.combat, ["a"]);
  assert.deepEqual(state.itemOrder[UNGROUPED_ORGANIZER_ID], ["c", "b"]);
});

test("builds optional groups from conceptual categories without moving manually assigned items", () => {
  let state = addItemOrganizationGroup({}, { id: "manual", name: "Favoritas" }, itemIds);
  state = moveOrganizedItem(state, { itemId: "a", targetGroupId: "manual" }, itemIds);
  const items = [
    { id: "a", system: { group: "Combate" } },
    { id: "b", system: { group: "Natureza" } },
    { id: "c", system: { group: "Geral" } }
  ];
  let counter = 0;
  state = createGroupsFromItemCategories(state, items, () => `generated-${++counter}`);

  assert.equal(state.assignments.a, "manual");
  assert.equal(state.assignments.b, "generated-1");
  assert.equal(state.assignments.c, undefined);
  assert.equal(state.groups["generated-1"].name, "Natureza");
});
