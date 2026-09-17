import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const removedPacks = ["advantages", "disadvantages", "equipment", "spells", "powers"];
const functionalPacks = [
  "templates",
  "modifiers",
  "gatilhos",
  "efeitos",
  "conditions",
  "status_bindings",
  "regras",
  "skills",
  "macros",
  "eqp_modifiers",
  "gm_modifiers"
];

test("content-only packs are no longer distributed by the system", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  const declaredNames = new Set(manifest.packs.map(pack => pack.name));

  for (const packName of removedPacks) {
    assert.equal(declaredNames.has(packName), false, `${packName} should not be declared`);
    assert.equal(fs.existsSync(`packs/${packName}`), false, `${packName} directory should not exist`);
  }
});

test("functional packs remain declared and distributed", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  const declaredNames = new Set(manifest.packs.map(pack => pack.name));

  for (const packName of functionalPacks) {
    assert.equal(declaredNames.has(packName), true, `${packName} should remain declared`);
    assert.equal(fs.existsSync(`packs/${packName}`), true, `${packName} directory should remain available`);
  }
});
