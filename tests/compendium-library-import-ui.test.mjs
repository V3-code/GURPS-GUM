import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const importer = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

test("o diretório de compêndios oferece importação global e contextual", () => {
  assert.match(importer, /renderCompendiumDirectory/);
  assert.match(importer, /GUM\.LibraryImport\.ImportIntoCompendium/);
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
  assert.match(importer, /label: importLabel/);
  assert.match(importer, /condition: visible,[\s\S]*visible,[\s\S]*callback: onClick,[\s\S]*onClick/);
});

test("o menu contextual permite exportar e limpar compêndios de Item para o mestre", () => {
  assert.match(importer, /GUM\.LibraryImport\.ExportCompendium/);
  assert.match(importer, /GUM\.LibraryImport\.ClearCompendium/);
  assert.match(importer, /confirmAndClearCompendium/);
  assert.match(importer, /Item\.deleteDocuments/);
  assert.match(importer, /Folder\.deleteDocuments/);
});

test("a janela de destino usa formulário e seletor visual de modo", () => {
  assert.match(importer, /gum-compendium-import-form/);
  assert.match(importer, /gum-import-mode-picker/);
  assert.match(importer, /gum-compendium-import-dialog/);
  assert.match(importer, /classes: \["dialog", "gum", "gum-compendium-import-dialog"\]/);
});

test("o diretório de atores usa o nome de ação orientado ao personagem", () => {
  assert.match(main, /GUM\.LibraryImport\.ImportCharacter/);
  assert.doesNotMatch(main, /> Importar do GCS/);
});

test("os menus de compêndio usam opções com fundo escuro e texto legível", () => {
  assert.match(styles, /gum-compendium-import-dialog select option,[\s\S]*background-color: #181b20;[\s\S]*color: #f0ede7;/);
  assert.match(styles, /content-source-add select option,[\s\S]*background-color: #181b20;[\s\S]*color: #f0ede7;/);
  assert.match(styles, /color-scheme: dark;/);
});
