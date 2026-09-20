import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const importer = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");

test("o diretório de compêndios oferece importação global e contextual", () => {
  assert.match(importer, /renderCompendiumDirectory/);
  assert.match(importer, /Importar biblioteca neste compêndio/);
  assert.match(importer, /importFromJson\(\{ pack \}\)/);
});

test("a importação permite criar um compêndio mundial de Item", () => {
  assert.match(importer, /Criar novo compêndio/);
  assert.match(importer, /CompendiumCollection\.createCompendium\(\{ label, name, type: "Item", package: "world" \}\)/);
});

test("os botões de importação dos diretórios ocupam uma linha independente", () => {
  assert.match(importer, /headerActions\.insertAdjacentElement\("afterend", row\)/);
  assert.match(main, /headerActions\.insertAdjacentElement\("afterend", row\)/);
});
