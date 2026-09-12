import assert from "node:assert/strict";
import test from "node:test";
import {
  EFFECT_ACTION_TYPES,
  effectMatchesTypeFilter,
  getEffectActionTypes
} from "../module/utils/effect-browser-filter.mjs";

test("reads all action modes from modern multi-action effects", () => {
  const system = { actions: [
    { type: "attribute" }, { type: "resource_change" }, { type: "chat" }
  ] };
  assert.deepEqual(getEffectActionTypes(system), ["attribute", "resource_change", "chat"]);
  assert.equal(effectMatchesTypeFilter(system, { resource_change: true }), true);
  assert.equal(effectMatchesTypeFilter(system, { macro: true }), false);
});

test("continues to filter legacy single-mode effects", () => {
  assert.equal(effectMatchesTypeFilter({ type: "resource_create" }, { resource_create: true }), true);
  assert.equal(effectMatchesTypeFilter({ type: "resource_create" }, { status: true }), false);
});

test("recognizes every mode offered by the effect editor", () => {
  for (const type of EFFECT_ACTION_TYPES) {
    assert.equal(effectMatchesTypeFilter({ actions: [{ type }] }, { [type]: true }), true, type);
  }
});

test("shows every effect when no mode filter is enabled", () => {
  assert.equal(effectMatchesTypeFilter({ actions: [{ type: "macro" }] }, { macro: false }), true);
});