import test from "node:test";
import assert from "node:assert/strict";
import { showDiceForMessageLessRoll } from "../module/utils/dice-so-nice.mjs";

test("delega ao Dice So Nice sem aguardar o fim da animação", async () => {
  const calls = [];
  let finishAnimation;
  const roll = { total: 9 };
  const user = { id: "player-1" };
  const shown = showDiceForMessageLessRoll(roll, {
    createChatMessage: false,
    dice3d: { showForRoll: (...args) => {
      calls.push(args);
      return new Promise(resolve => { finishAnimation = resolve; });
    } },
    user,
    whisper: ["gm-1"],
    blind: true
  });

  // O retorno não fica condicionado à Promise que o Dice So Nice resolve
  // somente depois de encerrar sua animação.
  assert.equal(shown, true);
  await Promise.resolve();
  assert.deepEqual(calls, [[roll, user, true, ["gm-1"], true]]);
  assert.equal(typeof finishAnimation, "function");
  finishAnimation();
});

test("não duplica a animação de rolagens que criam ChatMessage", async () => {
  let calls = 0;
  const shown = showDiceForMessageLessRoll({}, {
    createChatMessage: true,
    dice3d: { showForRoll: async () => { calls += 1; } }
  });

  assert.equal(shown, false);
  assert.equal(calls, 0);
});

test("mantém a rolagem funcional sem o módulo ou quando a animação falha", async () => {
  assert.equal(showDiceForMessageLessRoll({}, { createChatMessage: false }), false);

  const warnings = [];
  const shown = showDiceForMessageLessRoll({}, {
    createChatMessage: false,
    dice3d: { showForRoll: async () => { throw new Error("animation"); } },
    logger: { warn: (...args) => warnings.push(args) }
  });

  assert.equal(shown, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(warnings.length, 1);
});