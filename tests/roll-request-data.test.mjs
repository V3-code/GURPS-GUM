import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBarrierConsequence, isMatchingDamageResistance, normalizeChatRoll, normalizeResistanceRoll, normalizeRollRequest, normalizeRollTest } from "../module/utils/roll-request-data.mjs";

test("normaliza uma definição comum sem finalidades como Teste Geral", () => {
  const request = normalizeRollRequest({ targets: [{ targetKey: "Actor.a", recipientUserIds: ["u", "u"] }], test: { attributeKey: "HT" } }, { id: "r", userId: "gm", now: 1 });
  assert.equal(request.version, 1); assert.equal(request.status, "pending"); assert.equal(request.test.attributeKey, "ht");
  assert.deepEqual(request.test.requestedPurposeIds, []); assert.deepEqual(request.targets[0].recipientUserIds, ["u"]);
});

test("normaliza Barreira antiga sem exigir migração", () => {
  const value = normalizeResistanceRoll({ isResisted: true, attribute: "DX", modifier: "-2", applyOn: "success", margin: "3", chatText: "x", skipPromptCard: true, requestedPurposeIds: ["resist_poison"] });
  assert.deepEqual({ type: value.test.type, key: value.test.attributeKey, mod: value.test.fixedModifier }, { type: "attribute", key: "dx", mod: -2 });
  assert.equal(value.consequence.applyOn, "success"); assert.equal(value.consequence.minimumMargin, 3); assert.equal(value.skipPromptCard, true);
  assert.deepEqual(value.test.requestedPurposeIds, ["resist_poison"]);
});

test("normaliza ação de chat antiga e valor fixo", () => {
  const legacy = normalizeChatRoll({ has_roll: true, roll_label: "Teste", roll_attribute: "ht", roll_modifier: "2", whisperMode: "gm" });
  assert.equal(legacy.test.attributeKey, "ht"); assert.equal(legacy.test.fixedModifier, 2); assert.equal(legacy.whisperMode, "gm");
  assert.deepEqual(normalizeRollTest({ attribute: "fixed", roll_fixed_value: "12" }), { type: "fixed", attributeKey: "ht", skillUuid: null, skillName: null, specialization: "", sourceId: null, customDefault: null, fixedValue: 12, requestedPurposeIds: [], fixedModifier: 0, fixedModifierLabel: "" });
});

test("campos livres antigos distinguem atributos de nomes de perícia", () => {
  const ownedSkill = normalizeChatRoll({ roll_attribute: "Faca" }).test;
  assert.equal(ownedSkill.type, "skill");
  assert.equal(ownedSkill.skillName, "Faca");
  const compendiumSkill = normalizeResistanceRoll({ attribute: "Furtividade" }).test;
  assert.equal(compendiumSkill.type, "skill");
  assert.equal(compendiumSkill.skillName, "Furtividade");
  assert.equal(normalizeResistanceRoll({ attribute: "HT" }).test.type, "attribute");
});

test("preserva perícia, perícia personalizada e finalidades", () => {
  const skill = normalizeRollTest({ type: "skill", skillUuid: "Compendium.gum.skills.Item.x", skillName: "Venefício", requestedPurposeIds: ["resist_poison"] });
  assert.equal(skill.skillUuid, "Compendium.gum.skills.Item.x"); assert.deepEqual(skill.requestedPurposeIds, ["resist_poison"]);
  const custom = normalizeRollTest({ type: "custom-skill", skillName: "Especial", customDefault: { attributeKey: "iq", modifier: -4 } });
  assert.equal(custom.type, "customSkill"); assert.deepEqual(custom.customDefault, { attributeKey: "iq", modifier: -4 });
});

test("adaptador de Barreira respeita applyOn, margem e críticos canônicos", () => {
  assert.equal(evaluateBarrierConsequence({ outcome: "failure", margin: -2 }, { applyOn: "failure", minimumMargin: 2 }).shouldApply, true);
  assert.equal(evaluateBarrierConsequence({ outcome: "success", margin: 1 }, { applyOn: "success", minimumMargin: 2 }).shouldApply, false);
  assert.equal(evaluateBarrierConsequence({ outcome: "critical-success", margin: 8 }, { applyOn: "success", minimumMargin: 2 }).shouldApply, true);
  assert.equal(evaluateBarrierConsequence({ outcome: "critical-failure", margin: -8 }, { applyOn: "failure", minimumMargin: 2 }).shouldApply, true);
});

test("resultado de dano só retorna à janela, alvo, link e efeito correspondentes", () => {
  const application = { isDialogClosed: false, targetActor: { id: "actor" }, availableOnDamageEffects: [{ id: "link", item: { uuid: "Item.effect" } }] };
  assert.equal(isMatchingDamageResistance(application, { targetActorId: "actor", effectLinkId: "link", effectUuid: "Item.effect" }), true);
  assert.equal(isMatchingDamageResistance(application, { targetActorId: "other", effectLinkId: "link", effectUuid: "Item.effect" }), false);
  assert.equal(isMatchingDamageResistance({ ...application, isDialogClosed: true }, { targetActorId: "actor", effectLinkId: "link", effectUuid: "Item.effect" }), false);
  assert.equal(isMatchingDamageResistance(application, { targetActorId: "actor", effectLinkId: "wrong", effectUuid: "Item.effect" }), false);
});