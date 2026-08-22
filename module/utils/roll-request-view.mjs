const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function renderPendingRequestCard({ request, kicker, title, icon = "fas fa-dice", originLabel, targetName, targetImg, testLabel, modifierLabel = "", purposeLabels = [], description = "", extraPills = [], buttonClass, buttonLabel, buttonAttributes = "" }) {
  const purposes = purposeLabels.length ? purposeLabels : ["Teste Geral"];
  return `<article class="gum-test-request gum-resistance-request" data-request-id="${escapeHtml(request.id)}">
    <header><span class="request-card-icon"><i class="${escapeHtml(icon)}"></i></span><div><span class="request-card-kicker">${escapeHtml(kicker)}</span><h3>${escapeHtml(title)}</h3>${description ? `<p>${description}</p>` : ""}</div></header>
    <div class="request-summary"><span class="request-summary-pill"><i class="fas fa-bullseye"></i> ${escapeHtml(testLabel)}</span>${modifierLabel ? `<span class="request-summary-pill modifier"><i class="fas fa-lock"></i> ${escapeHtml(modifierLabel)}</span>` : ""}${purposes.map(label => `<span class="request-summary-pill purpose"><i class="fas fa-tag"></i> ${escapeHtml(label)}</span>`).join("")}${extraPills.map(label => `<span class="request-summary-pill">${escapeHtml(label)}</span>`).join("")}</div>
    <div class="request-targets"><div class="request-target-row"><div class="gum-request-target-summary"><img src="${escapeHtml(targetImg)}"><span>${escapeHtml(targetName)}</span><strong class="request-result">Pendente</strong></div><p class="gum-request-origin">Origem: ${escapeHtml(originLabel)}</p><button type="button" class="${escapeHtml(buttonClass)}" ${buttonAttributes}><i class="fas fa-dice-d6"></i> ${escapeHtml(buttonLabel)}</button><!-- gum-roll-request-result --></div></div>
  </article>`;
}

export function renderPendingResistanceRequest({ request, effectName, originLabel, targetName, targetImg, testLabel, modifierLabel = "", applyOnLabel, marginLabel, purposeLabels = [], description = "" }) {
  return renderPendingRequestCard({ request, kicker: "Barreira de Resistência", title: effectName, icon: "fas fa-shield-halved", originLabel, targetName, targetImg, testLabel, modifierLabel, purposeLabels, description: escapeHtml(description), extraPills: [applyOnLabel, `Margem mín. ${marginLabel}`], buttonClass: "resistance-roll-button", buttonLabel: "Rolar Resistência", buttonAttributes: `data-request-id="${escapeHtml(request.id)}"` });
}

export function renderPendingChatRollRequest({ request, target, purposeLabels = [] }) {
  const test = request.test;
  const testLabel = test.type === "attribute" ? test.attributeKey?.toUpperCase() : test.type === "fixed" ? `Valor fixo ${test.fixedValue}` : test.skillName;
  const modifierLabel = test.fixedModifier ? `${test.fixedModifier >= 0 ? "+" : ""}${test.fixedModifier} ${test.fixedModifierLabel || "Modificador fixo"}` : "";
  return renderPendingRequestCard({ request, kicker: "Mensagem de Efeito · Teste", title: request.title, icon: "fas fa-comment-dots", originLabel: request.origin?.effectUuid || "Item Efeito", targetName: target.actorName, targetImg: target.actorImg, testLabel, modifierLabel, purposeLabels, description: request.description, buttonClass: "gum-roll-request-button", buttonLabel: request.title, buttonAttributes: `data-target-key="${encodeURIComponent(target.targetKey)}"` });
}

export function appendResistanceRequestResult(content, { result, consequenceLabel, purposeLabels = [], userName = "" }) {
  const purposes = purposeLabels.length ? purposeLabels.join(", ") : "Teste Geral";
  const breakdown = (result.modifierBreakdown || []).map(entry => `<span class="request-modifier-part">${escapeHtml(entry.source || entry.label || "Modificador")} ${Number(entry.value) >= 0 ? "+" : ""}${escapeHtml(entry.value)}</span>`).join("");
  const fragment = `<div class="gum-request-inline-result"><div class="gum-request-result-heading"><strong class="request-result request-result-${escapeHtml(result.outcome)}">${escapeHtml(result.resultLabel)}</strong><span>Margem ${escapeHtml(result.margin)}</span><b>${escapeHtml(consequenceLabel)}</b></div><details open><summary>Detalhes da rolagem</summary><dl><dt>Dados</dt><dd>${escapeHtml(result.total)}</dd><dt>Alvo efetivo</dt><dd>${escapeHtml(result.effectiveTarget)}</dd><dt>Valor-base</dt><dd>${escapeHtml(result.baseValue)}</dd><dt>Modificadores</dt><dd>${breakdown || escapeHtml(result.totalModifier)}</dd><dt>Finalidades</dt><dd>${escapeHtml(purposes)}</dd><dt>Usuário</dt><dd>${escapeHtml(userName || result.userId)}</dd><dt>Horário</dt><dd>${new Date(result.submittedAt).toLocaleString()}</dd></dl></details></div>`;
  let updated = String(content || "").replace(/(<button\b[^>]*class="[^"]*(?:resistance-roll-button|gum-roll-request-button)[^"]*"[^>]*)(>)/i, "$1 disabled aria-disabled=\"true\"$2");
  updated = updated.replace(/(<strong class="request-result)[^"]*(">)Pendente(<\/strong>)/i, `$1 request-result-${escapeHtml(result.outcome)}$2Resolvido$3`);
  if (updated.includes("<!-- gum-roll-request-result -->")) return updated.replace("<!-- gum-roll-request-result -->", fragment);
  return `${updated}${fragment}`;
}