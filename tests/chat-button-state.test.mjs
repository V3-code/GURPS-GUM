import test from "node:test";
import assert from "node:assert/strict";
import { runWithChatButtonDisabled } from "../module/utils/chat-button-state.mjs";

test("mantém o botão desabilitado durante a ação e restaura quando ainda está conectado", async () => {
  const button = { disabled: false, isConnected: true };
  let disabledDuringAction = false;
  const executed = await runWithChatButtonDisabled(button, async () => { disabledDuringAction = button.disabled; });
  assert.equal(executed, true);
  assert.equal(disabledDuringAction, true);
  assert.equal(button.disabled, false);
});

test("tolera o rerender que desconecta o botão durante a rolagem", async () => {
  const button = { disabled: false, isConnected: true };
  await runWithChatButtonDisabled(button, async () => { button.isConnected = false; });
  assert.equal(button.disabled, true);
  assert.equal(button.isConnected, false);
});

test("ignora botão ausente ou ação já em processamento", async () => {
  let calls = 0;
  assert.equal(await runWithChatButtonDisabled(null, async () => { calls += 1; }), false);
  assert.equal(await runWithChatButtonDisabled({ disabled: true }, async () => { calls += 1; }), false);
  assert.equal(calls, 0);
});

test("restaura o botão conectado mesmo quando a ação falha", async () => {
  const button = { disabled: false, isConnected: true };
  await assert.rejects(runWithChatButtonDisabled(button, async () => { throw new Error("roll"); }), /roll/);
  assert.equal(button.disabled, false);
});