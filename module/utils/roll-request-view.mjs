export const ROLL_REQUEST_CARD_KEYS = Object.freeze({
  resistanceTitle: "GUM.RollRequestCard.ResistanceTitle",
  applyOnSuccess: "GUM.RollRequestCard.ApplyOnSuccess",
  applyOnFailure: "GUM.RollRequestCard.ApplyOnFailure",
  unknownOrigin: "GUM.RollRequestCard.UnknownOrigin",
  target: "GUM.RollRequestCard.Target",
  testOf: "GUM.RollRequestCard.TestOf",
  barrierModifier: "GUM.RollRequestCard.BarrierModifier",
  effectApplicable: "GUM.RollRequestCard.EffectApplicable",
  effectBlocked: "GUM.RollRequestCard.EffectBlocked",
  awaitingDamageApplication: "GUM.RollRequestCard.AwaitingDamageApplication",
  effectApplied: "GUM.RollRequestCard.EffectApplied",
  invalidResistanceRequest: "GUM.RollRequestCard.InvalidResistanceRequest",
  resistanceResultSentToGM: "GUM.RollRequestCard.ResistanceResultSentToGM",
  resistanceFailure: "GUM.RollRequestCard.ResistanceFailure"
});

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const localize = (key, fallback) => {
  const translated = globalThis.game?.i18n?.localize?.(key);
  return translated && translated !== key ? translated : fallback;
};
const format = (key, data, fallback) => {
  const translated = globalThis.game?.i18n?.format?.(key, data);
  if (translated && translated !== key) return translated;
  return Object.entries(data).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), fallback);
};

export function localizedRollOutcome(result) {
  const keys = {
    "critical-success": ["GUM.TestRequest.Status.CriticalSuccess", "Sucesso Crítico"],
    "critical-failure": ["GUM.TestRequest.Status.CriticalFailure", "Falha Crítica"],
    success: ["GUM.TestRequest.Status.Success", "Sucesso"],
    failure: ["GUM.TestRequest.Status.Failure", "Falha"]
  };
  const entry = keys[result?.outcome];
  return entry ? localize(...entry) : result?.resultLabel;
}

function renderPendingRequestCard({ request, kicker, title, icon = "fas fa-dice", originLabel, targetName, targetImg, testLabel, modifierLabel = "", purposeLabels = [], description = "", extraPills = [], buttonClass, buttonLabel, buttonAttributes = "" }) {
  const purposes = purposeLabels.length ? purposeLabels : [localize("GUM.RollRequestCard.GeneralTest", "Teste Geral")];
  return `<article class="gum-test-request gum-resistance-request" data-request-id="${escapeHtml(request.id)}">
    <header><span class="request-card-icon"><i class="${escapeHtml(icon)}"></i></span><div><span class="request-card-kicker">${escapeHtml(kicker)}</span><h3>${escapeHtml(title)}</h3>${description ? `<p>${description}</p>` : ""}</div></header>
    <div class="request-summary"><span class="request-summary-pill"><i class="fas fa-bullseye"></i> ${escapeHtml(testLabel)}</span>${modifierLabel ? `<span class="request-summary-pill modifier"><i class="fas fa-lock"></i> ${escapeHtml(modifierLabel)}</span>` : ""}${purposes.map(label => `<span class="request-summary-pill purpose"><i class="fas fa-tag"></i> ${escapeHtml(label)}</span>`).join("")}${extraPills.map(label => `<span class="request-summary-pill">${escapeHtml(label)}</span>`).join("")}</div>
    <div class="request-targets"><div class="request-target-row"><div class="gum-request-target-summary"><img src="${escapeHtml(targetImg)}"><span>${escapeHtml(targetName)}</span><strong class="request-result">${escapeHtml(localize("GUM.RollRequestCard.Pending", "Pendente"))}</strong></div><p class="gum-request-origin">${escapeHtml(localize("GUM.RollRequestCard.Origin", "Origem"))}: ${escapeHtml(originLabel)}</p><button type="button" class="${escapeHtml(buttonClass)}" ${buttonAttributes}><i class="fas fa-dice-d6"></i> ${escapeHtml(buttonLabel)}</button><!-- gum-roll-request-result --></div></div>
  </article>`;
}

export function renderPendingResistanceRequest({ request, effectName, originLabel, targetName, targetImg, testLabel, modifierLabel = "", applyOnLabel, marginLabel, purposeLabels = [], description = "" }) {
  return renderPendingRequestCard({ request, kicker: localize("GUM.RollRequestCard.ResistanceBarrier", "Barreira de Resistência"), title: effectName, icon: "fas fa-shield-halved", originLabel, targetName, targetImg, testLabel, modifierLabel, purposeLabels, description: escapeHtml(description), extraPills: [applyOnLabel, format("GUM.RollRequestCard.MinimumMargin", { margin: marginLabel }, `Margem mín. ${marginLabel}`)], buttonClass: "resistance-roll-button", buttonLabel: localize("GUM.RollRequestCard.RollResistance", "Rolar Resistência"), buttonAttributes: `data-request-id="${escapeHtml(request.id)}"` });
}

export function renderPendingChatRollRequest({ request, target, purposeLabels = [] }) {
  const test = request.test;
  const testLabel = test.type === "attribute" ? test.attributeKey?.toUpperCase() : test.type === "fixed" ? format("GUM.TestRequest.FixedValue", { value: test.fixedValue }, `Valor fixo ${test.fixedValue}`) : test.skillName;
  const modifierLabel = test.fixedModifier ? `${test.fixedModifier >= 0 ? "+" : ""}${test.fixedModifier} ${test.fixedModifierLabel || localize("GUM.TestRequest.FixedModifier", "Modificador fixo")}` : "";
  return renderPendingRequestCard({ request, kicker: localize("GUM.RollRequestCard.EffectMessageTest", "Mensagem de Efeito · Teste"), title: request.title, icon: "fas fa-comment-dots", originLabel: request.origin?.effectUuid || localize("GUM.RollRequestCard.EffectItem", "Item Efeito"), targetName: target.actorName, targetImg: target.actorImg, testLabel, modifierLabel, purposeLabels, description: request.description, buttonClass: "gum-roll-request-button", buttonLabel: request.title, buttonAttributes: `data-target-key="${encodeURIComponent(target.targetKey)}"` });
}

export function appendResistanceRequestResult(content, { result, consequenceLabel, purposeLabels = [], userName = "" }) {
  const purposes = purposeLabels.length ? purposeLabels.join(", ") : localize("GUM.RollRequestCard.GeneralTest", "Teste Geral");
  const breakdown = (result.modifierBreakdown || []).map(entry => `<span class="request-modifier-part">${escapeHtml(entry.source || entry.label || localize("GUM.RollRequestCard.Modifier", "Modificador"))} ${Number(entry.value) >= 0 ? "+" : ""}${escapeHtml(entry.value)}</span>`).join("");
  const resultLabel = localizedRollOutcome(result);
  const submittedAt = new Date(result.submittedAt).toLocaleString(globalThis.game?.i18n?.lang || undefined);
  const fragment = `<div class="gum-request-inline-result"><div class="gum-request-result-heading"><strong class="request-result request-result-${escapeHtml(result.outcome)}">${escapeHtml(resultLabel)}</strong><span>${escapeHtml(localize("GUM.RollRequestCard.Margin", "Margem"))} ${escapeHtml(result.margin)}</span><b>${escapeHtml(consequenceLabel)}</b></div><details open><summary>${escapeHtml(localize("GUM.RollRequestCard.RollDetails", "Detalhes da rolagem"))}</summary><dl><dt>${escapeHtml(localize("GUM.RollRequestCard.Dice", "Dados"))}</dt><dd>${escapeHtml(result.total)}</dd><dt>${escapeHtml(localize("GUM.RollRequestCard.EffectiveTarget", "Alvo efetivo"))}</dt><dd>${escapeHtml(result.effectiveTarget)}</dd><dt>${escapeHtml(localize("GUM.RollRequestCard.BaseValue", "Valor-base"))}</dt><dd>${escapeHtml(result.baseValue)}</dd><dt>${escapeHtml(localize("GUM.RollRequestCard.Modifiers", "Modificadores"))}</dt><dd>${breakdown || escapeHtml(result.totalModifier)}</dd><dt>${escapeHtml(localize("GUM.RollRequestCard.Purposes", "Finalidades"))}</dt><dd>${escapeHtml(purposes)}</dd><dt>${escapeHtml(localize("GUM.RollRequestCard.User", "Usuário"))}</dt><dd>${escapeHtml(userName || result.userId)}</dd><dt>${escapeHtml(localize("GUM.RollRequestCard.Time", "Horário"))}</dt><dd>${escapeHtml(submittedAt)}</dd></dl></details></div>`;
  let updated = String(content || "").replace(/(<button\b[^>]*class="[^"]*(?:resistance-roll-button|gum-roll-request-button)[^"]*"[^>]*)(>)/i, "$1 disabled aria-disabled=\"true\"$2");
  updated = updated.replace(/(<strong class="request-result)[^"]*(">)[\s\S]*?(<\/strong>)/i, `$1 request-result-${escapeHtml(result.outcome)}$2${escapeHtml(localize("GUM.RollRequestCard.Resolved", "Resolvido"))}$3`);
  if (updated.includes("<!-- gum-roll-request-result -->")) return updated.replace("<!-- gum-roll-request-result -->", fragment);
  return `${updated}${fragment}`;
}