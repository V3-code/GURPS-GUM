import test from "node:test";
import assert from "node:assert/strict";

import { resolveAttackDamageDisplay } from "../module/utils/attack-damage-display.mjs";

const attributes = {
  thrust_damage: "1d6-2",
  swing_damage: "1d6",
  thrust_damage_alt: "2d6-1",
  swing_damage_alt: "2d6"
};

test("resolves basic damage aliases and combines their modifiers for display", () => {
  assert.equal(resolveAttackDamageDisplay("GdP+2", attributes), "1d6");
  assert.equal(resolveAttackDamageDisplay("GeB-1", attributes), "1d6-1");
  assert.equal(resolveAttackDamageDisplay("GdPa+1", attributes), "2d6");
  assert.equal(resolveAttackDamageDisplay("GeBa+2", attributes), "2d6+2");
});

test("supports imported English aliases and the GdB spelling", () => {
  assert.equal(resolveAttackDamageDisplay("thr+1", attributes), "1d6-1");
  assert.equal(resolveAttackDamageDisplay("swing+2", attributes), "1d6+2");
  assert.equal(resolveAttackDamageDisplay("GdB-2", attributes), "1d6-2");
});

test("leaves formulas without a basic damage alias unchanged", () => {
  assert.equal(resolveAttackDamageDisplay("3d6+1", attributes), "3d6+1");
  assert.equal(resolveAttackDamageDisplay("2d6*2", attributes), "2d6*2");
});