import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeContextMenuEntries,
  registerContextMenuCompatibilityHooks
} from "../module/utils/context-menu-compatibility.mjs";

test("converte entradas legadas do menu de contexto para a API do Foundry 14", () => {
  const condition = () => true;
  let received;
  const callback = (target, event) => { received = { target, event }; };
  const entries = [{ name: "Tokenizer", condition, callback, icon: "tokenizer" }];

  assert.equal(normalizeContextMenuEntries(entries), entries);
  assert.equal(entries[0].label, "Tokenizer");
  assert.equal(entries[0].visible, condition);
  assert.equal(entries[0].icon, "tokenizer");
  assert.equal(typeof entries[0].onClick, "function");
  assert.equal("name" in entries[0], false);
  assert.equal("condition" in entries[0], false);
  assert.equal("callback" in entries[0], false);

  const event = { type: "click" };
  const target = { dataset: { entryId: "gum.conditions" } };
  entries[0].onClick(event, target);
  assert.deepEqual(received, { target, event });
});

test("preserva campos modernos quando uma integração também fornece aliases legados", () => {
  const visible = () => false;
  const onClick = () => "moderno";
  const entries = [{
    label: "Moderno",
    visible,
    onClick,
    name: "Legado",
    condition: () => true,
    callback: () => "legado"
  }];

  normalizeContextMenuEntries(entries);

  assert.deepEqual(entries, [{ label: "Moderno", visible, onClick }]);
});

test("registra o adaptador apenas nas versões que oferecem a API moderna", () => {
  const registrations = [];
  const Hooks = { on: (hook, callback) => registrations.push({ hook, callback }) };

  registerContextMenuCompatibilityHooks({ Hooks, generation: 13 });
  assert.equal(registrations.length, 0);

  registerContextMenuCompatibilityHooks({ Hooks, generation: 14 });
  assert.deepEqual(registrations.map(entry => entry.hook), [
    "getActorContextOptions",
    "getCompendiumContextOptions"
  ]);
});
