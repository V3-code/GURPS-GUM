import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync("templates/actors/characters.hbs", "utf8");
const styles = readFileSync("styles/styles.css", "utf8");

test("characteristic groups are rendered in the requested vertical order", () => {
  const groupIds = [...template.matchAll(/\sid="char-section-(block\d)"/g)].map((match) => match[1]);

  assert.deepEqual(groupIds, ["block1", "block2", "block3", "block4"]);
  assert.doesNotMatch(template, /characteristics-(?:left|right)-column/);
  assert.match(styles, /\.characteristics-main-content\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
});

test("characteristic cards wrap side by side inside each group", () => {
  assert.match(styles, /\.tab\[data-tab="characteristics"\] \.flex-wrap-container\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s);
  assert.match(styles, /\.characteristic-card\s*\{[^}]*flex-basis:\s*calc\(50% - 3px\);/s);
});