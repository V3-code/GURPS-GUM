import test from "node:test";
import assert from "node:assert/strict";
import { createRollRequestExecutor } from "../module/services/roll-request-executor.mjs";

const request = () => ({
  id: "request-1",
  title: "Resistir",
  targets: [{ targetKey: "actor-1", actorUuid: "Actor.1" }],
  test: { requestedPurposeIds: ["resist_poison"], fixedModifier: -2, fixedModifierLabel: "Veneno" }
});

function harness(overrides = {}) {
  const calls = [];
  const actor = { id: "1", img: "actor.webp" };
  const dependencies = {
    normalizeRequest: value => value,
    resolveTarget: async () => ({ actor, token: null }),
    authorize: () => true,
    resolveTest: async () => ({ available: true, type: "attribute", attributeKey: "ht", value: 12, label: "HT" }),
    performRoll: async (...args) => { calls.push(args); return { total: 9 }; },
    serializeResult: result => ({ total: result.total, serialized: true }),
    createPrompt: () => ({ render: () => {}, close: async () => {} }),
    getCurrentUser: () => ({ id: "user-1" }),
    ...overrides
  };
  return { actor, calls, execute: createRollRequestExecutor(dependencies) };
}

test("execução silenciosa usa o alvo persistido e nunca cria outro card", async () => {
  const { actor, calls, execute } = harness();
  const outcome = await execute(request(), "actor-1", { prompt: false });

  assert.equal(outcome.accepted, true);
  assert.deepEqual(outcome.result, { total: 9, serialized: true });
  assert.equal(calls[0][0], actor);
  assert.equal(calls[0][1].value, 12);
  assert.equal(calls[0][1].modifier, -2);
  assert.deepEqual(calls[0][1].purposeIds, ["resist_poison"]);
  assert.equal(calls[0][2].createChatMessage, false);
  assert.equal(calls[0][2].returnResult, true);
});

test("rejeita alvo ausente e usuário não autorizado antes da rolagem", async () => {
  const missing = harness();
  assert.deepEqual(await missing.execute(request(), "outro", { prompt: false }), { accepted: false, reason: "target" });
  assert.equal(missing.calls.length, 0);

  const denied = harness({ authorize: () => false });
  assert.deepEqual(await denied.execute(request(), "actor-1", { prompt: false }), { accepted: false, reason: "permission" });
  assert.equal(denied.calls.length, 0);
});

test("impede execução duplicada e libera a trava depois do resultado", async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { execute } = harness({ performRoll: async () => pending });
  const first = execute(request(), "actor-1", { prompt: false });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(await execute(request(), "actor-1", { prompt: false }), { accepted: false, reason: "processing" });
  finish({ total: 8 });
  assert.equal((await first).accepted, true);
  assert.equal((await execute(request(), "actor-1", { prompt: false })).accepted, true);
});

test("libera a trava quando a rolagem ou o callback falha", async () => {
  let attempt = 0;
  const { execute } = harness({ performRoll: async () => { if (!attempt++) throw new Error("dice"); return { total: 10 }; } });
  await assert.rejects(execute(request(), "actor-1", { prompt: false }), /dice/);
  assert.equal((await execute(request(), "actor-1", { prompt: false })).accepted, true);

  const callback = harness();
  await assert.rejects(callback.execute(request(), "actor-1", { prompt: false, onResult: async () => { throw new Error("update"); } }), /update/);
  assert.equal((await callback.execute(request(), "actor-1", { prompt: false })).accepted, true);
});

test("prompt recebe os dados atuais e fecha liberando a solicitação", async () => {
  let promptOptions;
  let closeCount = 0;
  const { execute } = harness({
    createPrompt: (_actor, rollData, options) => {
      promptOptions = { rollData, options };
      return { render: () => {}, close: async () => { closeCount += 1; } };
    }
  });
  assert.deepEqual(await execute(request(), "actor-1"), { accepted: true, pending: true });
  assert.equal(promptOptions.rollData.value, 12);
  assert.deepEqual(promptOptions.rollData.requestedPurposeIds, ["resist_poison"]);
  assert.deepEqual(await execute(request(), "actor-1"), { accepted: false, reason: "processing" });
  assert.equal((await promptOptions.options.onRoll({ id: "1" }, promptOptions.rollData)).accepted, true);
  assert.equal((await execute(request(), "actor-1")).accepted, true);
  // Closing without rolling is the other supported release path; exercise it separately.
  let app;
  const closing = harness({ createPrompt: () => (app = { render: () => {}, close: async () => { closeCount += 1; } }) });
  await closing.execute(request(), "actor-1");
  await app.close();
  assert.equal(closeCount, 1);
  assert.equal((await closing.execute(request(), "actor-1")).accepted, true);
});

test("falha síncrona ao abrir o prompt não deixa o pedido travado", async () => {
  let shouldFail = true;
  const { execute } = harness({ createPrompt: () => ({ close: async () => {}, render: () => { if (shouldFail) { shouldFail = false; throw new Error("render"); } } }) });
  await assert.rejects(execute(request(), "actor-1"), /render/);
  assert.equal((await execute(request(), "actor-1")).accepted, true);
});