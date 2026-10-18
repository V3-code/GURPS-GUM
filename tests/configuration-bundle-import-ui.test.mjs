import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const importer = readFileSync(new URL("../module/apps/configuration-bundle-import.js", import.meta.url), "utf8");
const gmScreen = readFileSync(new URL("../module/apps/gm-screen.js", import.meta.url), "utf8");

test("a janela de dependências usa o padrão visual dos importadores", () => {
  assert.match(importer, /gum-compendium-import-form gum-configuration-bundle-destination/);
  assert.match(importer, /gum-import-mode-picker/);
  assert.match(importer, /gum-compendium-import-dialog/);
  assert.match(importer, /width: 560/);
});

test("a janela exibe somente os campos do destino selecionado", () => {
  assert.match(importer, /data-destination="existing"/);
  assert.match(importer, /data-destination="new"/);
  assert.match(importer, /html\.find\("\[data-destination\]"\)\.hide\(\)/);
  assert.match(importer, /html\.find\(`\[data-destination="\$\{mode\}"\]`\)\.show\(\)/);
});

test("falhas de importação preservam a mensagem técnica útil", () => {
  assert.match(gmScreen, /LayoutImportError[\s\S]*error: err\?\.message \|\| String\(err\)/);
});

test("a importação oferece acrescentar, mesclar e substituir com prévia", () => {
  assert.match(importer, /previewConfigurationImport/);
  assert.match(importer, /value="add"/);
  assert.match(importer, /value="merge" checked/);
  assert.match(importer, /value="replace"/);
  assert.match(importer, /ReplaceWarning/);
  assert.match(importer, /combineConfigurationImport/);
});
