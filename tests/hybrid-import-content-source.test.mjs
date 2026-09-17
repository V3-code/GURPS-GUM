import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const importer = fs.readFileSync("module/apps/importers.js", "utf8");
const settings = fs.readFileSync("module/settings.js", "utf8");

test("hybrid character import searches world items before configured sources", () => {
  assert.match(importer, /game\.items\.contents/);
  assert.match(importer, /contentSourceService\.getSourceIds\("skills"\)/);
  assert.match(importer, /contentSourceService\.getSourceIds\("characterImport"\)/);
  assert.match(importer, /highestPriority = Math\.min/);
});

test("searching unrelated compendia is explicit and disabled by default", () => {
  assert.match(importer, /hybridImportSearchAllCompendia/);
  assert.match(importer, /searchAllCompendia\s*\? game\.packs\.filter/);
  assert.match(settings, /"hybridImportSearchAllCompendia"[\s\S]*?default: false/);
});

test("hybrid matching keeps specialization as part of the identity", () => {
  assert.match(importer, /specializationNorm: normalizeHybridText/);
  assert.match(importer, /entry\.baseNameNorm === wantedBaseName && entry\.specializationNorm === wantedSpec/);
});
