import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildDamageApplicationEvent,
  calculateShockPenalty,
  classifyDamageTargetPool
} from "../module/utils/damage-application-event.mjs";

test("classifies every damageable pool exposed by the application window", () => {
  assert.equal(classifyDamageTargetPool("system.attributes.hp.value"), "hp");
  assert.equal(classifyDamageTargetPool("system.attributes.fp.value"), "fp");
  assert.equal(classifyDamageTargetPool("system.combat.combat_meters.guard.current"), "combat-meter");
  assert.equal(classifyDamageTargetPool("system.spell_reserves.mana.current"), "spell-reserve");
  assert.equal(classifyDamageTargetPool("system.power_reserves.psi.value"), "power-reserve");
  assert.equal(classifyDamageTargetPool("equipment:item-id"), "equipment-reserve");
  assert.equal(classifyDamageTargetPool("equipment-integrity:item-id"), "equipment-integrity");
  assert.equal(classifyDamageTargetPool("system.resources.other.value"), "other");
});

test("calculates ordinary and high-HP shock penalties with the GURPS cap", () => {
  assert.equal(calculateShockPenalty(1, 10), 1);
  assert.equal(calculateShockPenalty(8, 10), 4);
  assert.equal(calculateShockPenalty(1, 20), 0);
  assert.equal(calculateShockPenalty(2, 20), 1);
  assert.equal(calculateShockPenalty(9, 20), 4);
  assert.equal(calculateShockPenalty(5, 30), 1);
  assert.equal(calculateShockPenalty(6, 30), 2);
});

test("builds a serializable HP damage pulse with legacy aliases and rule metadata", () => {
  const event = buildDamageApplicationEvent({
    eventId: "event-1",
    applicationId: "application-1",
    damage: {
      rolled: 12,
      modified: 12,
      penetrating: 8,
      injury: 8,
      type: "cort",
      nature: "fire",
      natureLabel: "Fogo",
      armorDivisor: 2,
      woundingModifier: 1.5,
      component: "main",
      shockPenalty: 4,
      modifiers: { halfDamage: false }
    },
    targetPool: {
      path: "system.attributes.hp.value",
      label: "PV",
      before: 14,
      after: 6,
      applied: 8,
      maximum: 14
    },
    hitLocation: {
      profileId: "humanoid",
      key: "face",
      label: "Rosto",
      roll: "5"
    },
    protection: { rawDR: 8, effectiveDR: 4, ignored: false },
    source: { actorUuid: "Actor.attacker", itemUuid: "Actor.attacker.Item.sword", attackId: "slash", attackType: "melee" },
    target: { actorUuid: "Actor.target", tokenUuid: "Scene.scene.Token.target" },
    combat: { id: "combat", round: 3, turn: 2 }
  });

  assert.equal(event.version, 2);
  assert.equal(event.type, "damage");
  assert.equal(event.pulse, true);
  assert.equal(event.appliedToHP, true);
  assert.equal(event.injury, 8);
  assert.equal(event.damage.total, 8);
  assert.equal(event.damage.type, "cort");
  assert.equal(event.damage.nature, "fire");
  assert.equal(event.targetPool.kind, "hp");
  assert.equal(event.targetPool.before, 14);
  assert.equal(event.targetPool.after, 6);
  assert.equal(event.targetPool.maximum, 14);
  assert.equal(event.hpBefore, 14);
  assert.equal(event.hpAfter, 6);
  assert.equal(event.hpMaximum, 14);
  assert.equal(event.hitLocationKey, "face");
  assert.equal(event.protection.effectiveDR, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(event)), event);
});

test("marks non-HP damage without losing its amount or location", () => {
  const event = buildDamageApplicationEvent({
    damage: { injury: 7, type: "cont" },
    targetPool: {
      path: "system.combat.combat_meters.shield.current",
      before: 10,
      after: 3
    },
    hitLocation: { key: "custom", label: "Escudo", custom: true }
  });

  assert.equal(event.appliedToHP, false);
  assert.equal(event.targetPool.kind, "combat-meter");
  assert.equal(event.damage.total, 7);
  assert.equal(event.hitLocation.key, "custom");
});

test("the major-wound expression excludes exact half HP and non-HP pools", () => {
  const qualifies = (event, maximumHP) => event?.type === "damage"
    && event?.appliedToHP === true
    && (event?.injury ?? 0) > maximumHP / 2;

  const hpFive = buildDamageApplicationEvent({ damage: { injury: 5 }, targetPool: { path: "system.attributes.hp.value" } });
  const hpSix = buildDamageApplicationEvent({ damage: { injury: 6 }, targetPool: { path: "system.attributes.hp.value" } });
  const fpSix = buildDamageApplicationEvent({ damage: { injury: 6 }, targetPool: { path: "system.attributes.fp.value" } });

  assert.equal(qualifies(hpFive, 10), false);
  assert.equal(qualifies(hpSix, 10), true);
  assert.equal(qualifies(fpSix, 10), false);
});

test("the application window emits the structured pulse and limits shock to HP", () => {
  const source = readFileSync(new URL("../scripts/apps/damage-application.js", import.meta.url), "utf8");
  assert.match(source, /buildDamageApplicationEvent\(\{/);
  assert.match(source, /updatePool\(newPoolValue, \{ gumEventData: eventData \}\)/);
  assert.match(source, /if \(applyShock && appliedToHP/);
  assert.match(source, /if \(targetIgnoresShock && game\.combat && appliedToHP/);
  assert.match(source, /calculateShockPenalty\([\s\S]+attributes\.hp\?\.final/);
});
