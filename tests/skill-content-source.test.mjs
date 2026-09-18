import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("skill request consumers use the centralized multi-source index", () => {
  const launcher = fs.readFileSync("module/apps/test-request-launcher.js", "utf8");
  const resolver = fs.readFileSync("module/services/roll-request-service.js", "utf8");

  assert.match(launcher, /contentSourceService\.getIndex\("skills"/);
  assert.match(resolver, /contentSourceService\.getIndex\("skills"/);
  assert.doesNotMatch(launcher, /game\.packs\.get\("gum\.skills"\)/);
  assert.doesNotMatch(resolver, /game\.packs\.get\("gum\.skills"\)/);
  assert.match(resolver, /fromUuid\(canonicalEntry\.uuid\)/);
});

test("skill list deduplicates semantically instead of retaining duplicate pack UUIDs", () => {
  const launcher = fs.readFileSync("module/apps/test-request-launcher.js", "utf8");
  assert.match(launcher, /skill\.sourceId \|\| `\$\{normalizeSkillText\(skill\.name\)\}::\$\{normalizeSkillText\(skill\.specialization\)\}`/);
  assert.doesNotMatch(launcher, /skill\.sourceId \|\| skill\.uuid/);
});
