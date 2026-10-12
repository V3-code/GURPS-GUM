import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sources = [
  read("module/utils/roll-request-view.mjs"), read("module/utils/test-request-view.mjs"),
  read("module/services/test-request-service.js"), read("module/services/roll-request-service.js"),
  read("templates/chat/test-request-card.hbs"), read("scripts/main.js"), read("scripts/apps/damage-application.js")
].join("\n");
const pt = JSON.parse(read("lang/pt-BR.json"));
const en = JSON.parse(read("lang/en.json"));

test("todos os textos internacionalizados dos cards de teste existem em português e inglês", () => {
  const keys = [...new Set(sources.match(/GUM\.RollRequest\.[A-Za-z]+/g) || [])];
  assert.ok(keys.length >= 40);
  for (const key of keys) {
    assert.equal(typeof pt[key], "string", `chave ausente em pt-BR: ${key}`);
    assert.equal(typeof en[key], "string", `chave ausente em en: ${key}`);
  }
});

test("template do pedido comum delega sua interface visível à localização", () => {
  const template = read("templates/chat/test-request-card.hbs");
  for (const text of ["Pedido do Mestre", "Progresso", "Rolar Teste", "Refazer", "Detalhes da rolagem"]) assert.doesNotMatch(template, new RegExp(text));
  assert.match(template, /GUM\.RollRequest\.GMRequest/);
  assert.match(template, /GUM\.RollRequest\.RollTest/);
});
