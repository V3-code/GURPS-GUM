import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");

function functionSource(name, nextName) {
  return main.slice(main.indexOf(`async function ${name}`), main.indexOf(nextName));
}

test("activation and consumption effects preserve the actor document that initiated the action", () => {
  const activation = functionSource("applyActivationEffects", "async function applyUseEventEffects");
  const useEvent = functionSource("applyUseEventEffects", "function buildEffectApplicationContext");

  assert.match(activation, /finalTargets = buildActorEffectTargets\(actor\)/);
  assert.doesNotMatch(activation, /actor\.getActiveTokens/);
  assert.match(useEvent, /finalTargets = buildActorEffectTargets\(actor\)/);
  assert.doesNotMatch(useEvent, /actor\.getActiveTokens/);
});

test("dropping an effect on an actor sheet preserves world and synthetic actor ownership", () => {
  const dropHandler = actorSheet.slice(actorSheet.indexOf("async _onDrop(event)"), actorSheet.indexOf("_getSkillOrganizationState"));

  assert.match(dropHandler, /const targets = buildActorEffectTargets\(this\.actor\)/);
  assert.doesNotMatch(dropHandler, /getActiveTokens/);
});

test("resisted effects only use an explicit token when the request names that token", () => {
  const resistance = main.slice(main.indexOf("async function processResistanceSocketResult"), main.indexOf("function enqueueResistanceSocketResult"));

  assert.equal((resistance.match(/targetToken \? \[targetToken\.object \|\| targetToken\] : buildActorEffectTargets\(actor\)/g) || []).length, 2);
  assert.doesNotMatch(resistance, /actor\.getActiveTokens/);
});
