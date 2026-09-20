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
  assert.match(importer, /Criar novo/);
  assert.match(importer, /CompendiumCollection\.createCompendium\(\{ label, name, type: "Item", package: "world" \}\)/);
});

test("os botões de importação dos diretórios ocupam uma linha independente", () => {
  assert.match(importer, /headerActions\.append\(row\)/);
  assert.match(main, /headerActions\.append\(row\)/);
});

test("o menu contextual oferece campos legados e modernos do Foundry", () => {
  assert.match(importer, /label: "Importar biblioteca neste compêndio"/);
  assert.match(importer, /condition: visible,[\s\S]*visible,[\s\S]*callback: onClick,[\s\S]*onClick/);
});

test("a janela de destino usa formulário e seletor visual de modo", () => {
  assert.match(importer, /gum-compendium-import-form/);
  assert.match(importer, /gum-import-mode-picker/);
  assert.match(importer, /gum-compendium-import-dialog/);
});
