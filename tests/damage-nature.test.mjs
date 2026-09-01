import test from "node:test";
import assert from "node:assert/strict";
import { DAMAGE_NATURES, resolveDamageNature, suggestDamageNatureAbbreviation } from "../module/utils/damage-nature.mjs";

test("Portuguese and English aliases resolve to stable nature ids", () => {
  assert.equal(resolveDamageNature("fog").id, "fire");
  assert.equal(resolveDamageNature("FIR").id, "fire");
  assert.equal(resolveDamageNature("Ice").id, "cold");
  assert.equal(resolveDamageNature("TDR").id, "direct-trauma");
  assert.equal(resolveDamageNature("Fogo [FOG]").id, "fire");
});

test("predefined aliases are unique and exactly three letters", () => {
  const aliases = DAMAGE_NATURES.flatMap(nature => nature.aliases);
  assert.ok(aliases.every(alias => /^[A-Z]{3}$/.test(alias)));
  assert.equal(new Set(aliases).size, aliases.length);
});

test("custom natures are safe and cannot shadow predefined aliases", () => {
  assert.deepEqual(resolveDamageNature("Luz Lunar [LZR]"), { id: "custom:luz-lunar", label: "Luz Lunar", abbreviation: "LZR", custom: true });
  assert.equal(resolveDamageNature("Outro [FOG]"), null);
  assert.equal(suggestDamageNatureAbbreviation("Luz Lunar"), "LZL");
});