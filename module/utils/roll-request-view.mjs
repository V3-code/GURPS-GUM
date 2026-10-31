const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const FALLBACKS = {
  "GUM.RollRequest.GeneralTest": "Teste Geral", "GUM.RollRequest.Pending": "Pendente", "GUM.RollRequest.Resolved": "Resolvido",
  "GUM.RollRequest.Origin": "Origem: {origin}", "GUM.RollRequest.ResistanceBarrier": "Barreira de Resistência",
  "GUM.RollRequest.EffectMessageTest": "Mensagem de Efeito · Teste", "GUM.RollRequest.EffectItem": "Item Efeito",
  "GUM.RollRequest.FixedValue": "Valor fixo {value}", "GUM.RollRequest.FixedModifier": "Modificador fixo",
  "GUM.RollRequest.MinimumMargin": "Margem mín. {value}", "GUM.RollRequest.RollResistance": "Rolar Resistência",
  "GUM.RollRequest.RerollResistance": "Rerolar resistência", "GUM.RollRequest.RerollTest": "Rerolar teste",
  "GUM.RollRequest.Margin": "Margem {value}", "GUM.RollRequest.RollDetails": "Detalhes da rolagem",
  "GUM.RollRequest.Dice": "Dados", "GUM.RollRequest.EffectiveTarget": "Alvo efetivo", "GUM.RollRequest.BaseValue": "Valor-base",
  "GUM.RollRequest.Modifiers": "Modificadores", "GUM.RollRequest.Purposes": "Finalidades", "GUM.RollRequest.User": "Usuário",
  "GUM.RollRequest.Time": "Horário", "GUM.RollRequest.Success": "Sucesso", "GUM.RollRequest.Failure": "Falha",
  "GUM.RollRequest.CriticalSuccess": "Sucesso Crítico", "GUM.RollRequest.CriticalFailure": "Falha Crítica",
  "GUM.RollRequest.SkipTest": "Não realizar o teste", "GUM.RollRequest.TestSkipped": "Teste dispensado"
};
const localize = key => {
  const translated = globalThis.game?.i18n?.localize?.(key);
  return translated && translated !== key ? translated : (FALLBACKS[key] ?? key);
};
const format = (key, data = {}) => {
  const translated = globalThis.game?.i18n?.format?.(key, data);
  if (translated && translated !== key) return translated;
  return Object.entries(data).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), localize(key));
};
const resultLabel = result => {
  const key = { success: "GUM.RollRequest.Success", failure: "GUM.RollRequest.Failure", "critical-success": "GUM.RollRequest.CriticalSuccess", "critical-failure": "GUM.RollRequest.CriticalFailure" }[result?.outcome];
  return key ? localize(key) : (result?.resultLabel || "");
};

function renderPendingRequestCard({ request, kicker, title, icon = "fas fa-dice", originLabel, targetName, targetImg, testLabel, modifierLabel = "", purposeLabels = [], description = "", extraPills = [], buttonClass, buttonLabel, buttonAttributes = "", skipButton = "", variantClass = "" }) {
  const purposes = purposeLabels.length ? purposeLabels : [localize("GUM.RollRequest.GeneralTest")];
  return `<article class="gum-test-request gum-resistance-request${variantClass ? ` ${escapeHtml(variantClass)}` : ""}" data-request-id="${escapeHtml(request.id)}">
    <header><span class="request-card-icon"><i class="${escapeHtml(icon)}"></i></span><div><span class="request-card-kicker">${escapeHtml(kicker)}</span><h3>${escapeHtml(title)}</h3></div></header>
    ${description ? `<div class="gum-request-description">${description}</div>` : ""}
    <div class="request-summary"><span class="request-summary-pill"><i class="fas fa-bullseye"></i> ${escapeHtml(testLabel)}</span>${modifierLabel ? `<span class="request-summary-pill modifier"><i class="fas fa-lock"></i> ${escapeHtml(modifierLabel)}</span>` : ""}${purposes.map(label => `<span class="request-summary-pill purpose"><i class="fas fa-tag"></i> ${escapeHtml(label)}</span>`).join("")}${extraPills.map(label => `<span class="request-summary-pill">${escapeHtml(label)}</span>`).join("")}</div>
    <div class="request-targets"><div class="request-target-row"><div class="gum-request-target-summary"><img src="${escapeHtml(targetImg)}"><span>${escapeHtml(targetName)}</span><strong class="request-result">${escapeHtml(localize("GUM.RollRequest.Pending"))}</strong></div><p class="gum-request-origin">${escapeHtml(format("GUM.RollRequest.Origin", { origin: originLabel }))}</p><div class="gum-request-actions"><button type="button" class="${escapeHtml(buttonClass)}" ${buttonAttributes}><i class="fas fa-dice-d6"></i> ${escapeHtml(buttonLabel)}</button>${skipButton}</div><div class="gum-request-result-anchor" data-gum-request-result-anchor></div></div></div>
  </article>`;
}

export function renderPendingResistanceRequest({ request, effectName, originLabel, targetName, targetImg, testLabel, modifierLabel = "", applyOnLabel, marginLabel, purposeLabels = [], description = "" }) {
  return renderPendingRequestCard({ request, kicker: localize("GUM.RollRequest.ResistanceBarrier"), title: effectName, icon: "fas fa-shield-halved", originLabel, targetName, targetImg, testLabel, modifierLabel, purposeLabels, description: escapeHtml(description), extraPills: [applyOnLabel, format("GUM.RollRequest.MinimumMargin", { value: marginLabel })], buttonClass: "resistance-roll-button", buttonLabel: localize("GUM.RollRequest.RollResistance"), buttonAttributes: `data-request-id="${escapeHtml(request.id)}"` });
}

export function renderPendingChatRollRequest({ request, target, purposeLabels = [] }) {
  const test = request.test;
  const testLabel = test.type === "attribute" ? test.attributeKey?.toUpperCase() : test.type === "fixed" ? format("GUM.RollRequest.FixedValue", { value: test.fixedValue }) : test.skillName;
  const modifierLabel = test.fixedModifier ? `${test.fixedModifier >= 0 ? "+" : ""}${test.fixedModifier} ${test.fixedModifierLabel || localize("GUM.RollRequest.FixedModifier")}` : "";
  const skipLabel = request.skip?.label || localize("GUM.RollRequest.SkipTest");
  const skipButton = request.skip?.allowed
    ? `<button type="button" class="gum-roll-request-skip-button" data-target-key="${escapeHtml(encodeURIComponent(target.targetKey))}"><i class="fas fa-ban"></i> ${escapeHtml(skipLabel)}</button>`
    : "";
  return renderPendingRequestCard({ request, kicker: localize("GUM.RollRequest.EffectMessageTest"), title: request.title, icon: "fas fa-comment-dots", originLabel: request.origin?.effectName || localize("GUM.RollRequest.EffectItem"), targetName: target.actorName, targetImg: target.actorImg, testLabel, modifierLabel, purposeLabels, description: request.description, buttonClass: "gum-roll-request-button", buttonLabel: request.title, buttonAttributes: `data-target-key="${encodeURIComponent(target.targetKey)}"`, skipButton, variantClass: "gum-chat-roll-request" });
}

export function appendSkippedRequestResult(content, { label = "" } = {}) {
  const resolvedLabel = label || localize("GUM.RollRequest.TestSkipped");
  let updated = String(content || "")
    .replace(/(<button\b[^>]*class="[^"]*(?:gum-roll-request-button|gum-roll-request-skip-button)[^"]*"[^>]*)(>)/gi, "$1 disabled aria-disabled=\"true\"$2")
    .replace(/<strong class="request-result(?: request-result-resolved)?">[^<]*<\/strong>/i, `<strong class="request-result request-result-resolved">${escapeHtml(localize("GUM.RollRequest.Resolved"))}</strong>`);
  const fragment = `<div class="gum-request-inline-result gum-request-skipped"><div class="gum-request-result-block"><strong>${escapeHtml(resolvedLabel)}</strong></div></div>`;
  const anchor = '<div class="gum-request-result-anchor" data-gum-request-result-anchor></div>';
  return updated.includes(anchor) ? updated.replace(anchor, `${fragment}${anchor}`) : `${updated}${fragment}`;
}

export function appendResistanceRequestResult(content, { result, consequenceLabel, purposeLabels = [], userName = "", allowReroll = false, targetKey = "", rerollClass = "gum-roll-request-reroll-button" }) {
  const purposes = purposeLabels.length ? purposeLabels.join(", ") : localize("GUM.RollRequest.GeneralTest");
  const breakdown = (result.modifierBreakdown || []).map(entry => `<span class="request-modifier-part">${escapeHtml(entry.source || entry.label || "Modificador")} ${Number(entry.value) >= 0 ? "+" : ""}${escapeHtml(entry.value)}</span>`).join("");
  const outcome = escapeHtml(result.outcome);
  const rerollLabel = rerollClass === "resistance-reroll-button" ? localize("GUM.RollRequest.RerollResistance") : localize("GUM.RollRequest.RerollTest");
  const rerollButton = allowReroll ? `<button type="button" class="${escapeHtml(rerollClass)}" data-target-key="${escapeHtml(encodeURIComponent(targetKey))}"><i class="fas fa-rotate-right"></i> ${rerollLabel}</button>` : "";
  const fragment = `<div class="gum-request-inline-result"><div class="gum-request-result-block ${outcome}"><strong>${escapeHtml(resultLabel(result))}</strong><span>${escapeHtml(format("GUM.RollRequest.Margin", { value: result.margin }))}</span></div><p class="gum-request-consequence">${escapeHtml(consequenceLabel)}</p><details><summary>${escapeHtml(localize("GUM.RollRequest.RollDetails"))}</summary><dl><dt>${escapeHtml(localize("GUM.RollRequest.Dice"))}</dt><dd>${escapeHtml(result.total)}</dd><dt>${escapeHtml(localize("GUM.RollRequest.EffectiveTarget"))}</dt><dd>${escapeHtml(result.effectiveTarget)}</dd><dt>${escapeHtml(localize("GUM.RollRequest.BaseValue"))}</dt><dd>${escapeHtml(result.baseValue)}</dd><dt>${escapeHtml(localize("GUM.RollRequest.Modifiers"))}</dt><dd>${breakdown || escapeHtml(result.totalModifier)}</dd><dt>${escapeHtml(localize("GUM.RollRequest.Purposes"))}</dt><dd>${escapeHtml(purposes)}</dd><dt>${escapeHtml(localize("GUM.RollRequest.User"))}</dt><dd>${escapeHtml(userName || result.userId)}</dd><dt>${escapeHtml(localize("GUM.RollRequest.Time"))}</dt><dd>${new Date(result.submittedAt).toLocaleString()}</dd></dl></details></div>${rerollButton}`;
  let updated = String(content || "").replace(/(<button\b[^>]*class="[^"]*(?:resistance-roll-button|gum-roll-request-button|gum-roll-request-skip-button)[^"]*"[^>]*)(>)/gi, "$1 disabled aria-disabled=\"true\"$2");
  updated = updated.replace(/<button\b[^>]*class="[^"]*(?:gum-roll-request-reroll-button|resistance-reroll-button)[^"]*"[^>]*>.*?<\/button>/gi, "");
  updated = updated.replace(/<strong class="request-result(?: request-result-resolved)?">[^<]*<\/strong>/i, `<strong class="request-result request-result-resolved">${escapeHtml(localize("GUM.RollRequest.Resolved"))}</strong>`);
  const anchor = '<div class="gum-request-result-anchor" data-gum-request-result-anchor></div>';
  if (updated.includes(anchor)) return updated.replace(anchor, `${fragment}${anchor}`);
  if (updated.includes("<!-- gum-roll-request-result -->")) return updated.replace("<!-- gum-roll-request-result -->", fragment);
  if (/<\/div>\s*<\/div>\s*<\/article>\s*$/i.test(updated)) {
    return updated.replace(/<\/div>\s*<\/div>\s*<\/article>\s*$/i, `${fragment}</div></div></article>`);
  }
  return `${updated}${fragment}`;
}
