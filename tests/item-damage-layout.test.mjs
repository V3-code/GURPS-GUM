import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const itemSheetSource = readFileSync(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8");
const itemSheetStyles = readFileSync(new URL("../styles/item-sheet.css", import.meta.url), "utf8");

test("attack damage editor defines one grid column for every heading", () => {
  const rule = itemSheetStyles.match(/\.attack-editor-dialog \.attack-damage-table\s*\{[^}]+}/)?.[0] ?? "";
  const columns = rule.match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? "";

  assert.equal((columns.match(/minmax\(/g) ?? []).length, 6);
});

test("attack damage editor keeps divisor before scaling in every row", () => {
  const editor = itemSheetSource.slice(
    itemSheetSource.indexOf('<div class="attack-damage-table">'),
    itemSheetSource.indexOf("const meleeFields"),
  );

  assert.match(editor, /Fórmula[\s\S]+Tipo[\s\S]+Natureza[\s\S]+Div\.[\s\S]+Escala/);
  for (const prefix of ["", "follow_up_damage.", "fragmentation_damage."]) {
    const nature = editor.indexOf(`${prefix}nature`);
    const divisor = editor.indexOf(`${prefix}armor_divisor`);
    const scaling = editor.indexOf(`${prefix}scaling`);
    assert.ok(nature >= 0 && nature < divisor && divisor < scaling, `unexpected ${prefix || "primary."} field order`);
  }
});