import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sheet = readFileSync(new URL("../module/item/money-source-sheet.js", import.meta.url), "utf8");

test("a ficha de fonte monetária abre com largura inicial ampliada", () => {
  assert.match(sheet, /width: 520/);
});
