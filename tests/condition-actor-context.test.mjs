import assert from "node:assert/strict";
import test from "node:test";

import {
  buildActorEffectTarget,
  buildActorEffectTargets,
  getActorEvaluationKey
} from "../module/utils/condition-actor-context.mjs";

test("world actor remains the sole effect owner even when it has active tokens", () => {
  const syntheticActor = { id: "actor-1", uuid: "Scene.scene.Token.token.Actor.actor-1" };
  const actor = {
    id: "actor-1",
    uuid: "Actor.actor-1",
    name: "Herói",
    img: "hero.webp",
    isToken: false,
    getActiveTokens: () => [{ actor: syntheticActor }]
  };

  const targets = buildActorEffectTargets(actor);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].actor, actor);
  assert.equal(targets[0].id, null);
});

test("synthetic actor retains its own token as effect and visual context", () => {
  const actor = { id: "actor-1", uuid: "Scene.scene.Token.token.Actor.actor-1", isToken: true };
  const tokenObject = { id: "token", actor };
  actor.token = { id: "token", actor, object: tokenObject };

  assert.equal(buildActorEffectTarget(actor), tokenObject);
});

test("separate unlinked token actors have separate evaluation keys", () => {
  const worldActor = { id: "actor-1", uuid: "Actor.actor-1" };
  const firstTokenActor = { id: "actor-1", uuid: "Scene.scene.Token.first.Actor.actor-1", isToken: true };
  const secondTokenActor = { id: "actor-1", uuid: "Scene.scene.Token.second.Actor.actor-1", isToken: true };

  assert.notEqual(getActorEvaluationKey(worldActor), getActorEvaluationKey(firstTokenActor));
  assert.notEqual(getActorEvaluationKey(firstTokenActor), getActorEvaluationKey(secondTokenActor));
});

test("missing actors do not produce effect targets or evaluation keys", () => {
  assert.equal(buildActorEffectTarget(null), null);
  assert.deepEqual(buildActorEffectTargets(null), []);
  assert.equal(getActorEvaluationKey(null), null);
});