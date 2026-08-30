import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { appendResistanceRequestResult, renderPendingChatRollRequest, renderPendingResistanceRequest } from "../module/utils/roll-request-view.mjs";

const english = JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8"));
const mainSource = await readFile(new URL("../scripts/main.js", import.meta.url), "utf8");
const viewSource = await readFile(new URL("../module/utils/roll-request-view.mjs", import.meta.url), "utf8");
const resolve = key => key.split(".").reduce((value, part) => value?.[part], english);

async function withEnglish(run) {
  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: {
      lang: "en",
      localize: key => resolve(key) ?? key,
      format: (key, data) => Object.entries(data).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), resolve(key) ?? key)
    }
  };
  try {
    await run();
  } finally {
    globalThis.game = previousGame;
  }
}

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

test("card compartilhado acompanha o idioma ativo sem alterar seus identificadores", async () => {
  await withEnglish(() => {
    const pending = renderPendingResistanceRequest({ request: { id: "request" }, effectName: "Poison", originLabel: "Wizard", targetName: "Target", targetImg: "actor.webp", testLabel: "HT Roll", applyOnLabel: "On failure", marginLabel: "0" });
    assert.match(pending, /Resistance Barrier/);
    assert.match(pending, /Pending/);
    assert.match(pending, /Origin: Wizard/);
    assert.match(pending, /Roll Resistance/);
    assert.match(pending, /Min\. margin 0/);
    assert.match(pending, /data-request-id="request"/);
    assert.doesNotMatch(pending, /Barreira de Resistência|Pendente|Rolar Resistência/);

    const resolved = appendResistanceRequestResult(pending, { result: { total: 9, effectiveTarget: 11, baseValue: 11, totalModifier: 0, modifierBreakdown: [], margin: 2, outcome: "success", resultLabel: "Sucesso", submittedAt: 1, userId: "user" }, consequenceLabel: "Effect applied", userName: "Player" });
    assert.match(resolved, /Resolved/);
    assert.match(resolved, /Success/);
    assert.match(resolved, /Roll Details/);
    assert.match(resolved, /Effective target/);
    assert.match(resolved, /resistance-roll-button[^>]*disabled/);
    assert.doesNotMatch(resolved, />Sucesso<|>Resolvido<|Pendente/);
  });
});

test("integração de resistência preserva estados e payloads mecânicos", () => {
  assert.match(mainSource, /"rollRequest:damageResult"/);
  assert.match(mainSource, /"rollRequest:barrierResult"/);
  assert.match(mainSource, /status: "pending"/);
  assert.match(mainSource, /evaluateBarrierConsequence\(payload\.result, request\.consequence\)/);
  assert.match(mainSource, /ROLL_REQUEST_CARD_KEYS\.resistanceTitle/);
  assert.doesNotMatch(mainSource, /ui\.notifications\.(?:info|warn)\("Resultado de resistência|ui\.notifications\.(?:info|warn)\("Não foi possível (?:validar|realizar) o (?:pedido|teste) de resistência/);
  assert.ok(viewSource.includes('replace(/(<strong class="request-result)[^"]*(">)[\\s\\S]*?(<\\/strong>)/i'));
  assert.doesNotMatch(viewSource, /replace\([^\n]+Pendente/);
});