import test from "node:test";
import assert from "node:assert/strict";
import { appendResistanceRequestResult, renderPendingChatRollRequest, renderPendingResistanceRequest } from "../module/utils/roll-request-view.mjs";

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
  assert.match(resolved, /A ponte está cedendo/);
  assert.match(resolved, /gum-roll-request-button[^>]*disabled/);
  assert.ok(resolved.indexOf("gum-roll-request-button") < resolved.indexOf("gum-request-inline-result"));
});

test("resultado é acrescentado abaixo do botão sem substituir o card solicitado", () => {
  const pending = renderPendingResistanceRequest({ request: { id: "request" }, effectName: "Veneno", targetName: "Alvo", testLabel: "HT", applyOnLabel: "Em falha", marginLabel: "0" });
  const resolved = appendResistanceRequestResult(pending, { result: { total: 12, effectiveTarget: 10, baseValue: 10, totalModifier: 0, modifierBreakdown: [], purposeIds: [], margin: -2, outcome: "failure", resultLabel: "Falha", submittedAt: 1, userId: "user" }, consequenceLabel: "Efeito aplicado", userName: "Jogador" });
  assert.match(resolved, /gum-test-request gum-resistance-request/);
  assert.match(resolved, /resistance-roll-button[^>]*disabled/);
  assert.match(resolved, /gum-request-inline-result/);
  assert.ok(resolved.indexOf("resistance-roll-button") < resolved.indexOf("gum-request-inline-result"));
});