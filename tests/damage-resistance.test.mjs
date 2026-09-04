import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  calculateDamageResistance,
  parseDamageResistanceEffectPath
} from "../module/utils/damage-resistance.mjs";

test("damage resistance combines armor, manual, temporary and passive layers by damage type", () => {
  const result = calculateDamageResistance({
    armor: { base: 6, cont: 2, cort: -1 },
    mod: { base: 1, cont: 1 },
    temp: { base: 2, qmd: 3 },
    passive: { base: 1, perf: 2 }
  });

  assert.deepEqual(result.computed, { base: 10, cont: 3, cort: -1, qmd: 3, perf: 2 });
  assert.deepEqual(result.final, result.computed);
});

test("base override replaces the whole computed base while preserving type deltas", () => {
  const result = calculateDamageResistance({
    armor: { base: 6, cont: 2 },
    passive: { base: 2 },
    override: { base: 4 }
  });

  assert.deepEqual(result.computed, { base: 8, cont: 2 });
  assert.deepEqual(result.final, { base: 4, cont: 2 });
});

test("damage-type override is stored as a compatible delta but resolves to its absolute value", () => {
  const result = calculateDamageResistance({
    armor: { base: 6, cont: 2 },
    mod: { base: 1 },
    override: { cont: 12 }
  });

  assert.deepEqual(result.computed, { base: 7, cont: 2 });
  assert.deepEqual(result.final, { base: 7, cont: 5 });
  assert.equal(result.final.base + result.final.cont, 12);
});

test("effect paths support every DR input layer and default to base damage", () => {
  assert.deepEqual(parseDamageResistanceEffectPath("system.combat.dr_temp_mods.torso.qmd"), {
    requestedLayer: "temp_mods", location: "torso", damageType: "qmd"
  });
  assert.deepEqual(parseDamageResistanceEffectPath("combat.dr_passive_mods.head"), {
    requestedLayer: "passive_mods", location: "head", damageType: "base"
  });
  assert.deepEqual(parseDamageResistanceEffectPath("system.attributes.st.temp"), null);
});

test("actor preparation exposes computed/final DR and rebuilds effect layers", () => {
  const source = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
  assert.match(source, /combat\.dr_temp_mods = \{\}/);
  assert.match(source, /combat\.dr_passive_mods = \{\}/);
  assert.match(source, /parseDamageResistanceEffectPath\(normalizedPath\)/);
  assert.match(source, /combat\.dr_final_computed = computedDr/);
  assert.match(source, /combat\.dr_locations = totalDr/);
});

test("DR dialog identifies permanent and fixed override inputs separately", () => {
  const source = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
  assert.match(source, /<div>Perm\.<\/div>/);
  assert.match(source, /RD fixa que substitui o total calculado">Fixa<\/div>/);
  assert.doesNotMatch(source, /<div>Override<\/div>/);
  assert.match(source, /Valor calculado antes do override/);
});