import test from "node:test";
import assert from "node:assert/strict";
import { captureActorResourceChanges } from "../module/utils/actor-resource-change.mjs";

const actor = { system: { attributes: { hp: { value: 3, final: 10 }, fp: { value: 8, max: 12 } } } };

test("detecta mudança aninhada de PV e fornece aliases de limiar", () => {
  const [event] = captureActorResourceChanges(actor, { system: { attributes: { hp: { value: -7 } } } }, { eventIdFactory: () => "evt" });
  assert.deepEqual({ type: event.type, resource: event.resource, before: event.before, after: event.after, maximum: event.maximum }, { type: "resource_change", resource: "hp", before: 3, after: -7, maximum: 10 });
  assert.deepEqual({ hpBefore: event.hpBefore, hpAfter: event.hpAfter, hpMaximum: event.hpMaximum, direction: event.direction }, { hpBefore: 3, hpAfter: -7, hpMaximum: 10, direction: "decrease" });
});

test("detecta chave achatada e relaciona o evento causador sem reutilizar seu id", () => {
  const [event] = captureActorResourceChanges(actor, { "system.attributes.fp.value": 4 }, { eventData: { type: "damage", eventId: "damage-1" } });
  assert.equal(event.eventId, "damage-1:fp-change");
  assert.deepEqual(event.source, { type: "damage", eventId: "damage-1" });
  assert.equal(event.fpBefore, 8);
  assert.equal(event.fpAfter, 4);
});

test("ignora atualizações sem mudança real de recurso", () => {
  assert.deepEqual(captureActorResourceChanges(actor, { system: { attributes: { hp: { value: 3 } } } }), []);
  assert.deepEqual(captureActorResourceChanges(actor, { name: "Outro nome" }), []);
});
