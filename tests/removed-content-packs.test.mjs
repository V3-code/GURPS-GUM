import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const removedPacks = [
  "advantages",
  "armor",
  "disadvantages",
  "equipment",
  "eqp_modifiers",
  "efeitos",
  "gatilhos",
  "gm_modifiers",
  "macros",
  "modifiers",
  "powers",
  "conditions",
  "regras",
  "skills",
  "spells",
  "templates",
  "status_bindings"
];
test("content-only packs are no longer distributed by the system", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  const declaredNames = new Set(manifest.packs.map(pack => pack.name));

  for (const packName of removedPacks) {
    assert.equal(declaredNames.has(packName), false, `${packName} should not be declared`);
    assert.equal(fs.existsSync(`packs/${packName}/.gitkeep`), false, `${packName} should not contain distributed files`);
  }
});

test("the system does not declare or distribute compendium packs", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  assert.deepEqual(manifest.packs, []);
});

test("the manifest contains no obsolete pack labels", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  assert.equal(manifest.packs.some(pack => /^GUM\.Packs\./.test(pack.label)), false);
});
