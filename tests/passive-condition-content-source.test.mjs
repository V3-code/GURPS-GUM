import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("actor creation and synchronization use configured passive condition sources", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(main, /contentSourceService\.getDocuments\("passiveConditions"\)/);
  assert.match(settings, /contentSourceService\.getDocuments\("passiveConditions"\)/);
  assert.doesNotMatch(main, /game\.packs\.get\("gum\.regras"\)/);
  assert.doesNotMatch(settings, /game\.packs\.get\("gum\.Regras"\)/);
});

test("passive condition copies retain their exact source UUID", () => {
  const main = fs.readFileSync("scripts/main.js", "utf8");
  const settings = fs.readFileSync("module/settings.js", "utf8");

  assert.match(main, /normalizeItemForV13\(item\.toObject\(\), item\.uuid\)/);
  assert.match(settings, /sourceRulesMap\.set\(rule\.uuid, rule\)/);
  assert.match(settings, /sourceRulesMap\.get\(sourceId\)/);
});
