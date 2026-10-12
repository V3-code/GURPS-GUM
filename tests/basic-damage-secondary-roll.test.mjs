import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");

test("sidebar basic damage rolls and carries prompt-created secondary damage", () => {
  const start = source.indexOf('html.on("click", ".rollable-basic-damage"');
  const end = source.indexOf("// EDITOR UNIFICADO DE ATRIBUTOS SECUNDÁRIOS", start);
  const handler = source.slice(start, end);

  for (const key of ["followUpAdditional", "fragmentationAdditional", "followUpFormula", "fragmentationFormula", "followUpRoll", "fragmentationRoll"]) {
    assert.match(handler, new RegExp(key));
  }
  assert.match(handler, /damagePackage\.followUp/);
  assert.match(handler, /damagePackage\.fragmentation/);
  assert.match(handler, /rolls: \[roll, followUpRoll, fragmentationRoll\]\.filter\(Boolean\)/);
});
