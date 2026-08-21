import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [template, sheet] = await Promise.all([
  readFile(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8"),
  readFile(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8")
]);

test("o retrato usa uma ação própria sem acionar a captura do Tokenizer", () => {
  const portrait = template.match(/<img class="profile-img"[^>]+>/)?.[0] ?? "";

  assert.match(portrait, /data-action="edit-portrait"/);
  assert.doesNotMatch(portrait, /data-edit="img"/);
});

test("a ação escolhe uma imagem e atualiza o retrato do ator", () => {
  assert.match(sheet, /new FilePickerImpl\(\{/);
  assert.match(sheet, /this\.actor\.update\(\{ img: path \}\)/);
  assert.match(sheet, /'click keydown', '\[data-action="edit-portrait"\]'/);
});