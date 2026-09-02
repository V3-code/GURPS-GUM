import test from "node:test";
import assert from "node:assert/strict";
import { DAMAGE_NATURES, buildDamageNatureSearchOptions, formatDamageNature, resolveDamageNature, suggestDamageNatureAbbreviation } from "../module/utils/damage-nature.mjs";

test("Portuguese and English aliases resolve to stable nature ids", () => {
  assert.equal(resolveDamageNature("fog").id, "fire");
  assert.equal(resolveDamageNature("FIR").id, "fire");
  assert.equal(resolveDamageNature("Ice").id, "cold");
  assert.equal(resolveDamageNature("TDR").id, "direct-trauma");
assert.equal(resolveDamageNature("Fogo [FOG]").id, "fire");
  assert.equal(resolveDamageNature("fgo").id, "fire");
  assert.equal(resolveDamageNature("fre").id, "fire");
  assert.equal(resolveDamageNature("poison").id, "poison");
  assert.equal(resolveDamageNature("veneno").id, "poison");
  assert.equal(resolveDamageNature("force").id, "magical-force");
  assert.equal(resolveDamageNature("forc").id, "magical-force");
  assert.equal(resolveDamageNature("frc").id, "magical-force");
});

test("predefined aliases are unique, regardless of length", () => {
  const aliases = DAMAGE_NATURES.flatMap(nature => nature.aliases);
  assert.ok(aliases.every(alias => /^[A-Z]+$/.test(alias)));
  assert.equal(new Set(aliases).size, aliases.length);
});

test("known natures are displayed with their canonical name only", () => {
  assert.equal(formatDamageNature(DAMAGE_NATURES[0]), "Fogo");
  assert.equal(formatDamageNature("FRE"), "Fogo");
  assert.equal(formatDamageNature("poison"), "Veneno");
});

test("search options identify aliases and English names with the canonical nature", () => {
  const options = buildDamageNatureSearchOptions();
  assert.deepEqual(options.find(option => option.value === "PSY"), { value: "PSY", label: "Psíquico" });
  assert.deepEqual(options.find(option => option.value === "Poison"), { value: "Poison", label: "Veneno" });
  assert.deepEqual(options.find(option => option.value === "FRC"), { value: "FRC", label: "Força Mágica" });
});

test("custom natures are safe and cannot shadow predefined aliases", () => {
  assert.deepEqual(resolveDamageNature("Luz Lunar [LZR]"), { id: "custom:luz-lunar", label: "Luz Lunar", abbreviation: "LZR", custom: true });
  assert.deepEqual(resolveDamageNature("Temporal (TEMPO)"), { id: "custom:temporal", label: "Temporal", abbreviation: "TEMPO", custom: true });
  assert.equal(resolveDamageNature("Outro [FOG]"), null);
  assert.equal(suggestDamageNatureAbbreviation("Luz Lunar"), "LZL");
});

test("legacy undefined labels recover the known nature", () => {
  assert.equal(resolveDamageNature("Fogo [undefined]").id, "fire");
});