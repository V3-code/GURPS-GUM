import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { appendResistanceRequestResult, appendSkippedRequestResult, renderPendingChatRollRequest, renderPendingResistanceRequest } from "../module/utils/roll-request-view.mjs";

const english = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

test("card de Barreira segue a estrutura visual de Solicitar Teste", () => {
  const content = renderPendingResistanceRequest({ request: { id: "request" }, effectName: "Veneno", targetName: "Alvo", testLabel: "HT", applyOnLabel: "Em falha", marginLabel: "0", purposeLabels: ["Resistência a Veneno"] });
  assert.match(content, /gum-test-request gum-resistance-request/);
  assert.match(content, /request-summary-pill purpose/);
  assert.match(content, /resistance-roll-button/);
});

test("Mensagem de Chat com teste usa o mesmo padrão e preserva sua mensagem", () => {
  const request = { id: "chat", title: "Evitar queda", description: "A ponte está cedendo.", origin: { effectUuid: "Item.effect" }, test: { type: "attribute", attributeKey: "dx", fixedModifier: 0 } };
  const pending = renderPendingChatRollRequest({ request, target: { targetKey: "Actor.a", actorName: "Alvo", actorImg: "actor.webp" }, purposeLabels: ["Equilíbrio"] });
  const resolved = appendResistanceRequestResult(pending, { result: { total: 9, effectiveTarget: 11, baseValue: 11, totalModifier: 0, modifierBreakdown: [], margin: 2, outcome: "success", resultLabel: "Sucesso", submittedAt: 1 }, consequenceLabel: "Resposta registrada" });
  assert.match(resolved, /gum-test-request/);
  assert.match(resolved, /gum-chat-roll-request/);
  assert.match(resolved, /A ponte está cedendo/);
  assert.doesNotMatch(resolved, /gum-request-description[^>]*>[\s\S]*gurps-effect-chat-card/);
  assert.match(resolved, /gum-roll-request-button[^>]*disabled/);
  assert.ok(resolved.indexOf("gum-roll-request-button") < resolved.indexOf("gum-request-inline-result"));
  assert.match(resolved, /request-result-resolved[^>]*>Resolvido/);
  assert.match(resolved, /gum-request-result-block success[^>]*><strong>Sucesso<\/strong><span>Margem 2<\/span>/);
  assert.doesNotMatch(resolved, /<details open>/);
});

test("teste opcional permite Fazer Nada e registra a dispensa sem rolagem", () => {
  const request = { id: "collapse", title: "Teste de Consciência", skip: { allowed: true, label: "Fazer Nada (não testar)" }, origin: {}, test: { type: "attribute", attributeKey: "ht", fixedModifier: -2, fixedModifierLabel: "por múltiplo completo de PV abaixo de zero" } };
  const pending = renderPendingChatRollRequest({ request, target: { targetKey: "Actor.a", actorName: "Alvo", actorImg: "actor.webp" } });
  assert.match(pending, /-2 por múltiplo completo de PV abaixo de zero/);
  assert.match(pending, /gum-roll-request-skip-button/);
  assert.match(pending, /Fazer Nada \(não testar\)/);
  const skipped = appendSkippedRequestResult(pending, { label: request.skip.label });
  assert.match(skipped, /gum-roll-request-button[^>]*disabled/);
  assert.match(skipped, /gum-roll-request-skip-button[^>]*disabled/);
  assert.match(skipped, /request-result-resolved[^>]*>Resolvido/);
});

test("resultado é acrescentado abaixo do botão sem substituir o card solicitado", () => {
  const pending = renderPendingResistanceRequest({ request: { id: "request" }, effectName: "Veneno", targetName: "Alvo", testLabel: "HT", applyOnLabel: "Em falha", marginLabel: "0" });
  const resolved = appendResistanceRequestResult(pending, { result: { total: 12, effectiveTarget: 10, baseValue: 10, totalModifier: 0, modifierBreakdown: [], purposeIds: [], margin: -2, outcome: "failure", resultLabel: "Falha", submittedAt: 1, userId: "user" }, consequenceLabel: "Efeito aplicado", userName: "Jogador", allowReroll: true, targetKey: "Actor.target", rerollClass: "resistance-reroll-button" });
  assert.match(resolved, /gum-test-request gum-resistance-request/);
  assert.match(resolved, /resistance-roll-button[^>]*disabled/);
  assert.match(resolved, /gum-request-inline-result/);
  assert.match(resolved, /gum-request-result-block failure[^>]*><strong>Falha<\/strong><span>Margem -2<\/span>/);
  assert.match(resolved, /<details><summary>Detalhes da rolagem<\/summary>/);
  assert.ok(resolved.indexOf("resistance-roll-button") < resolved.indexOf("gum-request-inline-result"));
  assert.ok(resolved.indexOf("gum-request-inline-result") < resolved.indexOf("gum-request-result-anchor"));
  assert.ok(resolved.indexOf("gum-request-result-anchor") < resolved.lastIndexOf("</article>"));
  assert.match(resolved, /resistance-reroll-button[^>]*data-target-key="Actor.target"/);
  assert.match(resolved, /gum-request-inline-result[\s\S]*?<\/div><button[^>]*resistance-reroll-button/);
});

test("resultado de mensagem de efeito oferece rerrolagem e mantém o histórico", () => {
  const request = { id: "chat", title: "Equilíbrio", test: { type: "attribute", attributeKey: "dx", fixedModifier: 0 } };
  const pending = renderPendingChatRollRequest({ request, target: { targetKey: "Actor.target", actorName: "Alvo", actorImg: "actor.webp" } });
  const result = { total: 10, effectiveTarget: 11, baseValue: 11, totalModifier: 0, modifierBreakdown: [], margin: 1, outcome: "success", resultLabel: "Sucesso", submittedAt: 1 };
  const first = appendResistanceRequestResult(pending, { result, consequenceLabel: "Resposta registrada", allowReroll: true, targetKey: "Actor.target" });
  const second = appendResistanceRequestResult(first, { result: { ...result, total: 12, margin: -1, outcome: "failure", resultLabel: "Falha" }, consequenceLabel: "Resultado da rerrolagem registrado", allowReroll: true, targetKey: "Actor.target" });
  assert.match(first, /gum-roll-request-reroll-button[^>]*data-target-key="Actor.target"/);
  assert.equal((second.match(/gum-request-inline-result/g) || []).length, 2);
  assert.equal((second.match(/gum-roll-request-reroll-button/g) || []).length, 1);
});

test("card compartilhado traduz ações, estados e detalhes para inglês", () => {
  const previousGame = globalThis.game;
  globalThis.game = { i18n: {
    localize: key => english[key] ?? key,
    format: (key, data) => Object.entries(data).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), english[key] ?? key)
  } };
  try {
    const pending = renderPendingResistanceRequest({ request: { id: "request" }, effectName: "Poison", originLabel: "Wizard", targetName: "Target", testLabel: "HT", applyOnLabel: english["GUM.RollRequest.OnFailure"], marginLabel: "0" });
    const resolved = appendResistanceRequestResult(pending, { result: { total: 12, effectiveTarget: 10, baseValue: 10, totalModifier: 0, modifierBreakdown: [], margin: -2, outcome: "failure", resultLabel: "Falha", submittedAt: 1 }, consequenceLabel: english["GUM.RollRequest.EffectBlocked"], allowReroll: true, targetKey: "Actor.target", rerollClass: "resistance-reroll-button" });
    for (const text of ["Resistance Barrier", "Roll Resistance", "Resolved", "Failure", "Margin -2", "Roll details", "Reroll resistance"]) assert.match(resolved, new RegExp(text));
  } finally {
    globalThis.game = previousGame;
  }
});
