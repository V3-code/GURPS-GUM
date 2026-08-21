import { GurpsRollPrompt } from "../apps/roll-prompt.js";
import { performGURPSRoll } from "../../scripts/main.js";
import { getPurposeLabels } from "../utils/roll-purposes.mjs";
import { createTestRequest, getTestRequestProgress, getTestRequestResponse, insertTestRequestResponse } from "../utils/test-request-data.mjs";
import { isUserAuthorizedForTarget } from "../utils/test-request-targets.mjs";
import { resolveSkillDefault } from "../utils/skill-default-resolver.mjs";
import { formatTestRequestStatus, prepareModifierBreakdown, prepareResponseHistory } from "../utils/test-request-view.mjs";

const queues = new Map();
const duplicate = value => foundry.utils.duplicate(value);

async function resolveTarget(target) {
  return fromUuid(target.tokenUuid || target.actorUuid).then(document => document?.actor ?? document).catch(() => null);
}

async function resolveTargetTokenImage(target) {
  if (!target.tokenUuid) return null;
  return fromUuid(target.tokenUuid)
    .then(document => document?.texture?.src ?? document?.document?.texture?.src ?? null)
    .catch(() => null);
}

function responsibleGM(message) {
  const author = game.users.get(message.user?.id ?? message.user);
  if (author?.active && author.isGM) return author;
  return game.users.filter(user => user.active && user.isGM).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
}

export async function renderTestRequestMessage(request) {
  const progress = getTestRequestProgress(request);
  const progressPercent = progress.total ? Math.round((progress.answered / progress.total) * 100) : 0;
  const purposes = getPurposeLabels(request.test.requestedPurposeIds);
  let canonicalSkill = null;
  if (request.test.type === "skill" && request.test.skillUuid) canonicalSkill = await fromUuid(request.test.skillUuid).catch(() => null);
  const targets = await Promise.all(request.targets.map(async target => {
    const actor = await resolveTarget(target);
    let unavailableReason = null;
    if (!actor) unavailableReason = "O personagem não está mais disponível.";
    else if (request.test.type === "attribute") {
      const value = Number(actor.system?.attributes?.[request.test.attributeKey]?.final ?? actor.system?.attributes?.[request.test.attributeKey]?.value);
      if (!Number.isFinite(value)) unavailableReason = "O atributo solicitado não está disponível.";
    } else {
      const definition = canonicalSkill ? { ...request.test, predefined: canonicalSkill.system?.predefined } : request.test;
      const resolution = resolveSkillDefault(actor, definition);
      if (!resolution.available) unavailableReason = resolution.reason;
    }
    const response = getTestRequestResponse(request, target.targetKey);
    const user = response ? game.users.get(response.userId) : null;
    const history = prepareResponseHistory(response);
    return { ...target, unavailableReason, response, status: response ? formatTestRequestStatus(response) : unavailableReason ? "Indisponível" : "Aguardando",
      hasResponse: Boolean(response), encodedKey: encodeURIComponent(target.targetKey), responseUserName: user?.name ?? response?.userId ?? "—",
      submittedAtLabel: response?.submittedAt ? new Date(response.submittedAt).toLocaleString(game.i18n?.lang || "pt-BR") : "",
      responsePurposeLabels: getPurposeLabels(response?.purposeIds), modifierBreakdown: prepareModifierBreakdown(response, request.test.fixedModifier, request.test.fixedModifierLabel), ...history };
  }));
  return renderTemplate("systems/gum/templates/chat/test-request-card.hbs", { request, progress, progressPercent, purposes, targets,
    testLabel: request.test.type === "attribute" ? request.test.attributeKey?.toUpperCase() : request.test.skillName });
}

export async function createTestRequestMessage(data) {
  const request = createTestRequest(data, { id: foundry.utils.randomID(), userId: game.user.id });
  const content = await renderTestRequestMessage(request);
  const message = await ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker(), content, flags: { gum: { testRequest: request } } });
  if (request.delivery.notifyPlayers) game.socket.emit("system.gum", { type: "testRequest:notify", messageId: message.id, requestId: request.id,
    notification: { title: request.title, targets: request.targets.map(target => ({ targetKey: target.targetKey, actorName: target.actorName, recipientUserIds: target.recipientUserIds })) } });
  return message;
}

function serializableResult(result, actor, target, resolution) {
  return { userId: game.user.id, actorUuid: target.actorUuid, tokenUuid: target.tokenUuid, submittedAt: Date.now(), total: result.total,
    effectiveTarget: result.effectiveLevel, margin: result.margin, outcome: result.outcome, resultLabel: result.resultLabel,
    baseValue: result.baseValue, totalModifier: result.totalModifier, modifierBreakdown: result.modifierBreakdown ?? [],
    purposeIds: result.purposeIds ?? [], rollJSON: result.rollJSON, defaultLabel: resolution?.label ?? null };
}

export async function rollTestRequest(messageId, targetKey, { replace = false } = {}) {
  const message = game.messages.get(messageId);
  const request = message?.getFlag("gum", "testRequest");
  const target = request?.targets?.find(entry => entry.targetKey === targetKey);
  if (!target) return ui.notifications.warn("Alvo do pedido não encontrado.");
  const actor = await resolveTarget(target);
  const tokenImg = await resolveTargetTokenImage(target);
  if (!isUserAuthorizedForTarget(game.user, actor, target)) return ui.notifications.error("Você não pode rolar por este personagem.");
  if (replace && !await Dialog.confirm({ title: "Refazer teste", content: "<p>Substituir o resultado atual?</p>" })) return;
  let resolution;
  let value;
  let itemId = null;
  let itemUuid = null;
  if (request.test.type === "attribute") value = Number(actor.system?.attributes?.[request.test.attributeKey]?.final ?? actor.system?.attributes?.[request.test.attributeKey]?.value);
  else {
    let definition = request.test;
    if (request.test.skillUuid) {
      const canonical = await fromUuid(request.test.skillUuid).catch(() => null);
      if (canonical) definition = { ...request.test, predefined: canonical.system?.predefined };
    }
    resolution = resolveSkillDefault(actor, definition);
    if (!resolution.available) return ui.notifications.warn(resolution.reason);
    value = resolution.value; itemId = resolution.itemId; itemUuid = resolution.itemUuid;
  }
  if (!Number.isFinite(value)) return ui.notifications.warn("O teste está indisponível para este personagem.");
  const rollData = { label: request.title, type: request.test.type === "attribute" ? "attribute" : "skill", attributeKey: request.test.attributeKey,
    value, itemId, itemUuid, requestedPurposeIds: request.test.requestedPurposeIds, fixedModifier: request.test.fixedModifier,
        fixedModifierLabel: request.test.fixedModifierLabel || "Modificador do Mestre", tokenImg, img: actor.img, defaultLabel: resolution?.label,
    initialBaseKey: request.test.type === "attribute" ? request.test.attributeKey : "skill" };
  new GurpsRollPrompt(actor, rollData, { onRoll: async (rollActor, payload, options) => {
    const result = await performGURPSRoll(rollActor, payload, { ...options, createChatMessage: false, returnResult: true });
    const socketPayload = { type: "testRequest:submitResponse", messageId, requestId: request.id, targetKey, userId: game.user.id, replace, response: serializableResult(result, actor, target, resolution) };
    // Socket.IO does not echo a system event back to its sender consistently
    // across the supported Foundry versions. A GM therefore processes their
    // own response directly; player responses still go to the responsible GM.
    if (game.user.isGM) {
      const accepted = await enqueueResponse(socketPayload);
      if (accepted) ui.notifications.info("Resultado incorporado ao pedido de teste.");
    } else {
      game.socket.emit("system.gum", socketPayload);
      ui.notifications.info("Resultado enviado ao Mestre.");
    }
  }}).render(true);
}

async function processResponse(payload) {
  const message = game.messages.get(payload.messageId);
  if (!message || responsibleGM(message)?.id !== game.user.id) return false;
  const current = duplicate(message.getFlag("gum", "testRequest"));
  if (!current || current.id !== payload.requestId || current.status !== "open") return false;
  const target = current.targets.find(entry => entry.targetKey === payload.targetKey);
  const actor = target && await resolveTarget(target);
  const sender = game.users.get(payload.userId);
  if (!target || !actor || !isUserAuthorizedForTarget(sender, actor, target)) return false;
  for (const key of ["total", "effectiveTarget", "margin", "baseValue", "totalModifier"]) if (!Number.isFinite(Number(payload.response?.[key]))) return false;
  let updated;
  try { updated = insertTestRequestResponse(current, payload.targetKey, payload.response, { replace: payload.replace === true }); }
  catch (error) { ui.notifications.warn(error.message); return false; }
  await message.update({ content: await renderTestRequestMessage(updated), "flags.gum.testRequest": updated });
  return true;
}

function enqueueResponse(payload) {
  const previous = queues.get(payload.messageId) ?? Promise.resolve();
  const next = previous
    .then(() => processResponse(payload))
    .catch(error => {
      console.error("GUM | Pedido de teste", error);
      return false;
    });
  const queued = next.finally(() => {
    if (queues.get(payload.messageId) === queued) queues.delete(payload.messageId);
  });
  queues.set(payload.messageId, queued);
  return queued;
}

export function registerTestRequestSocket() {
  game.socket.on("system.gum", payload => {
    if (payload?.type === "testRequest:submitResponse") {
      enqueueResponse(payload);
    } else if (payload?.type === "testRequest:notify") {
      const message = game.messages.get(payload.messageId);
      const request = message?.getFlag("gum", "testRequest");
      const notification = payload.notification ?? { title: request?.title, targets: request?.targets ?? [] };
      const eligible = notification.targets.filter(target => target.recipientUserIds?.includes(game.user.id));
      if (eligible.length) showTestRequestNotification(payload.messageId, notification.title, eligible);
    }
  });
}

function openTestRequestInChat(messageId) {
  ui.chat?.render?.(true);
  setTimeout(() => {
    const element = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    element?.classList?.add("gum-test-request-highlight");
    setTimeout(() => element?.classList?.remove("gum-test-request-highlight"), 1800);
  }, 100);
}

function showTestRequestNotification(messageId, title, targets) {
  const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
  const names = targets.map(target => `<li>${escape(target.actorName)}</li>`).join("");
  const buttons = {
    open: { icon: '<i class="fas fa-comments"></i>', label: "Abrir pedido", callback: () => openTestRequestInChat(messageId) }
  };
  if (targets.length === 1) buttons.roll = { icon: '<i class="fas fa-dice"></i>', label: "Rolar teste", callback: () => rollTestRequest(messageId, targets[0].targetKey) };
  new Dialog({ title: escape(title || "Teste solicitado pelo Mestre"), content: `<div class="test-request-notification-content"><p>Você pode responder pelos seguintes personagens:</p><ul>${names}</ul><small>O pedido continuará disponível no chat.</small></div>`, buttons, default: targets.length === 1 ? "roll" : "open" }, { classes: ["gum", "test-request-notification"] }).render(true);
}

export function activateTestRequestChatListeners(html) {
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(".test-request-roll").forEach(button => {
    const targetKey = decodeURIComponent(button.dataset.targetKey);
    const messageId = button.closest(".message")?.dataset.messageId ?? button.closest("li.chat-message")?.dataset.messageId;
    const message = game.messages.get(messageId);
    const target = message?.getFlag("gum", "testRequest")?.targets?.find(entry => entry.targetKey === targetKey);
    if (target && !game.user.isGM && !target.recipientUserIds.includes(game.user.id)) button.disabled = true;
    button.addEventListener("click", event => {
      const messageElement = event.currentTarget.closest(".message") ?? event.currentTarget.closest("li.chat-message");
      rollTestRequest(messageElement?.dataset.messageId, decodeURIComponent(event.currentTarget.dataset.targetKey), { replace: event.currentTarget.dataset.replace === "true" });
    });
  });
}