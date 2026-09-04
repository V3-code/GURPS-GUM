import test from "node:test";
import assert from "node:assert/strict";
import { applyContextsToInput, normalizeContextCsv, readSelectedContexts } from "../module/apps/context-picker.mjs";

const options = [{ id: "all" }, { id: "attack" }, { id: "defense" }];

test("normaliza, deduplica e rejeita contextos desconhecidos", () => {
  assert.equal(normalizeContextCsv("attack, attack, unknown, defense", options), "attack,defense");
  assert.equal(normalizeContextCsv("", options), "all");
  assert.equal(normalizeContextCsv("attack,all", options), "all");
});

test("lê seleções tanto de um elemento DOM quanto do invólucro jQuery legado", () => {
  const checked = [{ value: "attack" }, { value: "defense" }];
  const root = { querySelectorAll: () => checked };
  assert.deepEqual(readSelectedContexts(root), ["attack", "defense"]);
  assert.deepEqual(readSelectedContexts({ find: () => ({ toArray: () => checked }) }), ["attack", "defense"]);
});

test("aplica contextos ao campo e notifica o formulário", () => {
  const events = [];
  const input = {
    value: "all",
    ownerDocument: { defaultView: { Event: class { constructor(type, init) { this.type = type; this.bubbles = init.bubbles; } } } },
    dispatchEvent: event => events.push(event)
  };
  applyContextsToInput(input, "attack,defense", options);
  assert.equal(input.value, "attack,defense");
  assert.deepEqual(events.map(event => [event.type, event.bubbles]), [["input", true], ["change", true]]);
});