import { GurpsRollPrompt } from "../apps/roll-prompt.js";
import { performGURPSRoll } from "../../scripts/main.js";
import { normalizeSkillText, resolveSkillDefault } from "../utils/skill-default-resolver.mjs";
import { normalizeRollRequest } from "../utils/roll-request-data.mjs";
import { isUserAuthorizedForTarget } from "../utils/test-request-targets.mjs";
import { getPurposeLabels } from "../utils/roll-purposes.mjs";
import { appendResistanceRequestResult, renderPendingChatRollRequest } from "../utils/roll-request-view.mjs";
import { evaluateGurpsRollResult } from "../utils/gurps-roll-result.mjs";

const processing = new Set();
const resultQueues = new Map();

export async function resolveRollRequestTarget(target) {
  if (!target) return null;
  const document = await fromUuid(target.tokenUuid || target.actorUuid).catch(() => null);
  return { actor: document?.actor ?? document, token: document?.actor ? document : null };
}

export async function resolveRequestedTest(actor, rawTest = {}) {
  const request = normalizeRollRequest({ test: rawTest });
  const test = request.test;
  if (test.type === "fixed") return { available: true, value: test.fixedValue, label: `Valor fixo ${test.fixedValue}`, type: "attribute" };
  if (test.type === "attribute") {
    const value = Number(actor?.system?.attributes?.[test.attributeKey]?.final ?? actor?.system?.attributes?.[test.attributeKey]?.value);
    return Number.isFinite(value) ? { available: true, value, label: test.attributeKey.toUpperCase(), type: "attribute", attributeKey: test.attributeKey }
      : { available: false, reason: "O atributo solicitado não está disponível." };
  }
  let definition = test;
  const localResolution = resolveSkillDefault(actor, test);
  if (localResolution.available) return { ...localResolution, type: "skill", attributeKey: test.customDefault?.attributeKey ?? null };
  if (test.skillUuid) {
    const canonical = await fromUuid(test.skillUuid).catch(() => null);
    if (canonical) definition = { ...test, predefined: canonical.system?.predefined };
  } else if (test.skillName) {
    const pack = game.packs.get("gum.skills");
    const index = pack ? await pack.getIndex({ fields: ["system.specialization"] }).catch(() => []) : [];
    const canonicalEntry = Array.from(index).find(entry =>
      normalizeSkillText(entry.name) === normalizeSkillText(test.skillName)
      && (!test.specialization || normalizeSkillText(entry.system?.specialization) === normalizeSkillText(test.specialization))
    );
    const canonical = canonicalEntry ? await pack.getDocument(canonicalEntry._id).catch(() => null) : null;
    if (canonical) definition = { ...test, skillUuid: canonical.uuid, predefined: canonical.system?.predefined };
  }
  const resolved = resolveSkillDefault(actor, definition);
  return { ...resolved, type: "skill", attributeKey: test.customDefault?.attributeKey ?? null };
}

export function serializeRollRequestResult(result, { target = {}, resolution = {}, userId = game.user.id } = {}) {
  return {
    userId, actorUuid: target.actorUuid ?? null, tokenUuid: target.tokenUuid ?? null, submittedAt: Date.now(),
    total: result.total, baseValue: result.baseValue, totalModifier: result.totalModifier,
    modifierBreakdown: result.modifierBreakdown ?? [], effectiveTarget: result.effectiveLevel ?? result.effectiveTarget,
    margin: result.margin, outcome: result.outcome, resultLabel: result.resultLabel,
    purposeIds: result.purposeIds ?? [], rollJSON: result.rollJSON, defaultLabel: resolution.label ?? null
  };
}

export async function executeRollRequest(rawRequest, targetKey, { prompt = true, onResult } = {}) {
  const request = normalizeRollRequest(rawRequest);
  const key = `${request.id}:${targetKey}`;
  if (processing.has(key)) return { accepted: false, reason: "processing" };
  const target = request.targets.find(entry => entry.targetKey === targetKey);
  const resolvedTarget = await resolveRollRequestTarget(target);
  if (!target || !resolvedTarget?.actor) return { accepted: false, reason: "target" };
  if (!isUserAuthorizedForTarget(game.user, resolvedTarget.actor, target)) return { accepted: false, reason: "permission" };
  const resolution = await resolveRequestedTest(resolvedTarget.actor, request.test);
  if (!resolution.available) return { accepted: false, reason: resolution.reason };
  processing.add(key);
  const rollData = {
    label: request.title, type: resolution.type, attributeKey: resolution.attributeKey,
    value: resolution.value, itemId: resolution.itemId, itemUuid: resolution.itemUuid,
    requestedPurposeIds: request.test.requestedPurposeIds, purposeIds: request.test.requestedPurposeIds, fixedModifier: request.test.fixedModifier,
    fixedModifierLabel: request.test.fixedModifierLabel || "Modificador fixo", defaultLabel: resolution.label,
    initialBaseKey: resolution.type === "attribute" ? (resolution.attributeKey || "fixed") : "skill", img: resolvedTarget.actor.img
  };
  const run = async (actor, payload, options = {}) => {
    try {
      const result = await performGURPSRoll(actor, payload, { ...options, createChatMessage: false, returnResult: true });
      const serialized = serializeRollRequestResult(result, { target, resolution });
      await onResult?.(serialized, { request, target, actor, resolution });
      return { accepted: true, result: serialized };
    } finally { processing.delete(key); }
  };
  if (!prompt) return run(resolvedTarget.actor, { ...rollData, modifier: request.test.fixedModifier }, {});
  const promptApp = new GurpsRollPrompt(resolvedTarget.actor, rollData, { onRoll: run });
  const originalClose = promptApp.close.bind(promptApp);
  promptApp.close = async (...args) => {
    processing.delete(key);
    return originalClose(...args);
  };
  promptApp.render(true);
  return { accepted: true, pending: true };
}

export async function createSingleRollRequestMessage(data, chatData = {}) {
  const request = normalizeRollRequest(data, { id: foundry.utils.randomID(), userId: game.user.id });
  const content = renderPendingChatRollRequest({ request, target: request.targets[0] ?? {}, purposeLabels: getPurposeLabels(request.test.requestedPurposeIds) });
  return ChatMessage.create({ ...chatData, content, flags: { ...(chatData.flags ?? {}), gum: { ...(chatData.flags?.gum ?? {}), rollRequest: request } } });
}

export function activateRollRequestChatListeners(html) {
  const root = html?.querySelectorAll ? html : html?.[0];
  root?.querySelectorAll?.(".gum-roll-request-button").forEach(button => button.addEventListener("click", async event => {
    event.preventDefault();
    const messageId = button.closest(".message, li.chat-message")?.dataset.messageId;
    const message = game.messages.get(messageId);
    const request = message?.getFlag("gum", "rollRequest");
    if (!request || request.status !== "pending") return;
    button.disabled = true;
    const targetKey = decodeURIComponent(button.dataset.targetKey);
    const outcome = await executeRollRequest(request, targetKey, { onResult: async response => {
      if (!game.user.isGM) {
        game.socket.emit("system.gum", { type: "rollRequest:chatResult", messageId: message.id, requestId: request.id, targetKey, userId: game.user.id, result: response });
        ui.notifications.info("Resultado enviado ao Mestre.");
        return;
      }
      const updated = { ...request, status: "resolved", responses: [...(request.responses ?? []), response] };
      const content = appendResistanceRequestResult(message.content, { result: response, consequenceLabel: "Resposta registrada", purposeLabels: getPurposeLabels(response.purposeIds), userName: game.users.get(response.userId)?.name });
      await message.update({ content, "flags.gum.rollRequest": updated });
    }});
    if (!outcome.accepted) {
      button.disabled = false;
      const reason = !outcome.reason || ["target", "permission", "processing"].includes(outcome.reason)
        ? "Não foi possível realizar este teste."
        : outcome.reason;
      ui.notifications.warn(reason);
    }
  }));
}

function responsibleGM(message) {
  const author = game.users.get(message?.user?.id ?? message?.user);
  if (author?.active && author.isGM) return author;
  return game.users.filter(user => user.active && user.isGM).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
}

async function processChatRollResult(payload) {
  const message = game.messages.get(payload.messageId);
  if (!message || responsibleGM(message)?.id !== game.user.id) return false;
  const request = foundry.utils.duplicate(message.getFlag("gum", "rollRequest"));
  if (!request || request.id !== payload.requestId || request.status !== "pending" || request.consequence?.type !== "chat-record") return false;
  const target = request.targets?.find(entry => entry.targetKey === payload.targetKey);
  const resolved = target && await resolveRollRequestTarget(target);
  const sender = game.users.get(payload.userId);
  if (!resolved?.actor || !isUserAuthorizedForTarget(sender, resolved.actor, target)) return false;
  if (!["total", "baseValue", "totalModifier", "effectiveTarget", "margin"].every(key => Number.isFinite(Number(payload.result?.[key])))) return false;
  const canonical = evaluateGurpsRollResult(Number(payload.result.total), Number(payload.result.effectiveTarget));
  payload.result = { ...payload.result, margin: canonical.margin, outcome: canonical.outcome, resultLabel: canonical.resultLabel };
  await message.update({ "flags.gum.rollRequest.status": "processing" });
  const updated = { ...request, status: "resolved", responses: [...(request.responses ?? []), payload.result] };
  const content = appendResistanceRequestResult(message.content, { result: payload.result, consequenceLabel: "Resposta registrada", purposeLabels: getPurposeLabels(payload.result.purposeIds), userName: sender.name });
  await message.update({ content, "flags.gum.rollRequest": updated });
  return true;
}

export function registerRollRequestSocket() {
  game.socket.on("system.gum", payload => {
    if (payload?.type !== "rollRequest:chatResult") return;
    const previous = resultQueues.get(payload.messageId) ?? Promise.resolve();
    const next = previous.then(() => processChatRollResult(payload)).catch(error => { console.error("GUM | Roll request", error); return false; });
    const queued = next.finally(() => { if (resultQueues.get(payload.messageId) === queued) resultQueues.delete(payload.messageId); });
    resultQueues.set(payload.messageId, queued);
  });
}