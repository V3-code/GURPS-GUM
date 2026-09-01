import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const promptSource = readFileSync(new URL("../module/apps/damage-roll-prompt.js", import.meta.url), "utf8");
const promptStyles = readFileSync(new URL("../styles/roll-prompt.css", import.meta.url), "utf8");
const promptTemplate = readFileSync(new URL("../templates/apps/damage-roll-prompt.hbs", import.meta.url), "utf8");

test("damage roll prompt reserves one column for each row control", () => {
  const rule = promptStyles.match(/\.gum-damage-roll-prompt \.damage-row\s*\{[^}]+}/)?.[0] ?? "";
  const columns = rule.match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? "";

  assert.equal((columns.match(/minmax\(/g) ?? []).length, 4);
  assert.match(promptSource, /width:\s*560/);
});

test("every damage modifier row contains label, formula, type, and nature", () => {
  const rows = [...promptTemplate.matchAll(/<div class="damage-row">([\s\S]*?)<\/div>/g)].map(match => match[1]);

  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.match(row, /<label>/);
    assert.match(row, /data-formula-input="true"/);
    assert.match(row, /(?:data-type-input="true"|disabled)/);
    assert.match(row, /Nature"/);
  }
});