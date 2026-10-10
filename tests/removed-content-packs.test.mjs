import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const removedPacks = [
  "advantages",
  "armor",
  "disadvantages",
  "equipment",
  "eqp_modifiers",
  "gatilhos",
  "gm_modifiers",
  "macros",
  "modifiers",
  "powers",
  "skills",
  "spells",
  "templates",
  "status_bindings"
];
const functionalPacks = [
  "efeitos",
  "conditions",
  "regras"
];

test("content-only packs are no longer distributed by the system", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  const declaredNames = new Set(manifest.packs.map(pack => pack.name));

  for (const packName of removedPacks) {
    assert.equal(declaredNames.has(packName), false, `${packName} should not be declared`);
    if (packName === "status_bindings") {
      assert.equal(fs.existsSync(`packs/${packName}/.gitkeep`), false, `${packName} should not contain distributed files`);
    } else {
      assert.equal(fs.existsSync(`packs/${packName}`), false, `${packName} directory should not exist`);
    }
  }
});

test("only core mechanical packs remain declared and distributed", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  const declaredNames = new Set(manifest.packs.map(pack => pack.name));

  for (const packName of functionalPacks) {
    assert.equal(declaredNames.has(packName), true, `${packName} should remain declared`);
    assert.equal(fs.existsSync(`packs/${packName}`), true, `${packName} directory should remain available`);
  }
});

test("distributed pack labels use localization keys", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  for (const pack of manifest.packs) assert.match(pack.label, /^GUM\.Packs\./);
});
