import test from "node:test";
import assert from "node:assert/strict";
import { ConditionEventDeduper, normalizeConditionEffectLink, normalizeConditionEffectLinks, shouldExecuteConditionEffectLink } from "../module/utils/condition-effect-link.mjs";

test("vínculo antigo mantém execução ampla e remoção automática", () => {
  assert.deepEqual(normalizeConditionEffectLink({ uuid: "Item.x" }), { uuid: "Item.x", phase: "always", removeOnConditionEnd: true });
  assert.equal(shouldExecuteConditionEffectLink({}, { enter: true }), true);
  assert.equal(shouldExecuteConditionEffectLink({}, { turnStart: true }), true);
  assert.equal(shouldExecuteConditionEffectLink({}, { exit: true }), false);
});

test("fases explícitas executam somente no momento configurado", () => {
  assert.equal(shouldExecuteConditionEffectLink({ phase: "turnStart" }, { enter: true }), false);
  assert.equal(shouldExecuteConditionEffectLink({ phase: "turnStart" }, { turnStart: true }), true);
  assert.equal(shouldExecuteConditionEffectLink({ phase: "exit" }, { exit: true }), true);
  assert.equal(normalizeConditionEffectLink({ removeOnConditionEnd: false }).removeOnConditionEnd, false);
});

test("recupera arrays serializados pelo Foundry como objetos indexados", () => {
  assert.deepEqual(normalizeConditionEffectLinks({
    1: { uuid: "Item.b", phase: "turnStart", removeOnConditionEnd: "false" },
    0: { uuid: "Item.a" }
  }), [
    { uuid: "Item.a", phase: "always", removeOnConditionEnd: true },
    { uuid: "Item.b", phase: "turnStart", removeOnConditionEnd: false }
  ]);
});

test("deduplica o mesmo evento por ator e libera eventos expirados", () => {
  let now = 100;
  const deduper = new ConditionEventDeduper({ ttl: 10, now: () => now });
  assert.equal(deduper.claim("Actor.a", "event-1"), true);
  assert.equal(deduper.claim("Actor.a", "event-1"), false);
  assert.equal(deduper.claim("Actor.b", "event-1"), true);
  now = 111;
  assert.equal(deduper.claim("Actor.a", "event-1"), true);
});
