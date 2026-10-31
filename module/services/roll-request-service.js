import { GurpsRollPrompt } from "../apps/roll-prompt.js";
import { evaluateNumericFormula, performGURPSRoll } from "../../scripts/main.js";
import { normalizeSkillText, resolveSkillDefault } from "../utils/skill-default-resolver.mjs";
import { normalizeRollRequest } from "../utils/roll-request-data.mjs";
import { isUserAuthorizedForTarget } from "../utils/test-request-targets.mjs";
import { getPurposeLabels } from "../utils/roll-purposes.mjs";
import { appendResistanceRequestResult, appendSkippedRequestResult, renderPendingChatRollRequest } from "../utils/roll-request-view.mjs";
import { evaluateGurpsRollResult } from "../utils/gurps-roll-result.mjs";
import { createRollRequestExecutor } from "./roll-request-executor.mjs";
import { contentSourceService } from "./content-source-service.mjs";
import { resolveRequestedAttribute } from "../utils/requested-attributes.mjs";

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
    return resolveRequestedAttribute(actor?.system?.attributes, test.attributeKey);
  }
  let definition = test;
  const localResolution = resolveSkillDefault(actor, test);
  if (localResolution.available) return { ...localResolution, type: "skill", attributeKey: test.customDefault?.attributeKey ?? null };
  if (test.skillUuid) {
    const canonical = await fromUuid(test.skillUuid).catch(() => null);
    if (canonical) definition = { ...test, predefined: canonical.system?.predefined };
  } else if (test.skillName) {
    const { entries } = await contentSourceService.getIndex("skills", { fields: ["system.specialization"] });
    const canonicalEntry = entries.find(entry =>
      normalizeSkillText(entry.name) === normalizeSkillText(test.skillName)
      && (!test.specialization || normalizeSkillText(entry.system?.specialization) === normalizeSkillText(test.specialization))
    );
    const canonical = canonicalEntry ? await fromUuid(canonicalEntry.uuid).catch(() => null) : null;
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

export const executeRollRequest = createRollRequestExecutor({
  normalizeRequest: normalizeRollRequest,
  resolveTarget: resolveRollRequestTarget,
  authorize: isUserAuthorizedForTarget,
  resolveTest: resolveRequestedTest,
  performRoll: performGURPSRoll,
  serializeResult: serializeRollRequestResult,
  createPrompt: (actor, rollData, options) => new GurpsRollPrompt(actor, rollData, options),
  getCurrentUser: () => game.user,
  resolveFixedModifier: (test, actor) => test.fixedModifierFormula
    ? evaluateNumericFormula(test.fixedModifierFormula, { actor })
    : test.fixedModifier
});

export async function createSingleRollRequestMessage(data, chatData = {}) {
  const request = normalizeRollRequest(data, { id: foundry.utils.randomID(), userId: game.user.id });
  const target = request.targets[0] ?? {};
  const resolved = await resolveRollRequestTarget(target);
  if (request.test.fixedModifierFormula) {
    request.test.fixedModifier = evaluateNumericFormula(request.test.fixedModifierFormula, { actor: resolved?.actor });
  }
  const content = renderPendingChatRollRequest({ request, target, purposeLabels: getPurposeLabels(request.test.requestedPurposeIds) });
  return ChatMessage.create({ ...chatData, content, flags: { ...(chatData.flags ?? {}), gum: { ...(chatData.flags?.gum ?? {}), rollRequest: request } } });
}

export function activateRollRequestChatListeners(html) {
  const root = html?.querySelectorAll ? html : html?.[0];
  root?.querySelectorAll?.(".gum-roll-request-skip-button").forEach(button => button.addEventListener("click", async event => {
    event.preventDefault();
    const messageId = button.closest(".message, li.chat-message")?.dataset.messageId;
    const message = game.messages.get(messageId);
    const request = message?.getFlag("gum", "rollRequest");
    const targetKey = decodeURIComponent(button.dataset.targetKey);
    if (!request?.skip?.allowed || request.status !== "pending") return;
    button.disabled = true;
    if (!game.user.isGM) {
      game.socket.emit("system.gum", { type: "rollRequest:chatSkip", messageId, requestId: request.id, targetKey, userId: game.user.id });
      ui.notifications.info(game.i18n.localize("GUM.RollRequest.SkipSent"));
      return;
    }
    await processChatRollSkip({ messageId, requestId: request.id, targetKey, userId: game.user.id });
  }));
  root?.querySelectorAll?.(".gum-roll-request-button, .gum-roll-request-reroll-button").forEach(button => button.addEventListener("click", async event => {
    event.preventDefault();
    const messageId = button.closest(".message, li.chat-message")?.dataset.messageId;
    const message = game.messages.get(messageId);
    const request = message?.getFlag("gum", "rollRequest");
    const reroll = button.classList.contains("gum-roll-request-reroll-button");
    if (!request || (request.status !== "pending" && !(reroll && request.status === "resolved"))) return;
    button.disabled = true;
    const targetKey = decodeURIComponent(button.dataset.targetKey);
    const restoreButton = () => {
      if (button.isConnected) button.disabled = false;
    };
    let outcome;
    try {
      outcome = await executeRollRequest(request, targetKey, {
        onPromptClose: restoreButton,
        onResult: async response => {
          if (!game.user.isGM) {
            game.socket.emit("system.gum", { type: "rollRequest:chatResult", messageId: message.id, requestId: request.id, targetKey, userId: game.user.id, reroll, result: response });
            ui.notifications.info("Resultado enviado ao Mestre.");
            return;
          }
          const updated = { ...request, status: "resolved", responses: [...(request.responses ?? []), response] };
          const content = appendResistanceRequestResult(message.content, { result: response, consequenceLabel: game.i18n.localize(reroll ? "GUM.RollRequest.RerollRecorded" : "GUM.RollRequest.ResponseRecorded"), purposeLabels: getPurposeLabels(response.purposeIds), userName: game.users.get(response.userId)?.name, allowReroll: true, targetKey });
          await message.update({ content, "flags.gum.rollRequest": updated });
        }
      });
    } catch (error) {
      restoreButton();
      console.error("GUM | Falha ao abrir ou executar teste do card de efeito:", error);
      ui.notifications.error("Não foi possível realizar este teste.");
      return;
    }
    if (!outcome.accepted) {
      restoreButton();
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
  const reroll = payload.reroll === true;
  if (!request || request.id !== payload.requestId || (request.status !== "pending" && !(reroll && request.status === "resolved")) || request.consequence?.type !== "chat-record") return false;
  const target = request.targets?.find(entry => entry.targetKey === payload.targetKey);
  const resolved = target && await resolveRollRequestTarget(target);
  const sender = game.users.get(payload.userId);
  if (!resolved?.actor || !isUserAuthorizedForTarget(sender, resolved.actor, target)) return false;
  if (!["total", "baseValue", "totalModifier", "effectiveTarget", "margin"].every(key => Number.isFinite(Number(payload.result?.[key])))) return false;
  const canonical = evaluateGurpsRollResult(Number(payload.result.total), Number(payload.result.effectiveTarget));
  payload.result = { ...payload.result, margin: canonical.margin, outcome: canonical.outcome, resultLabel: canonical.resultLabel };
  await message.update({ "flags.gum.rollRequest.status": "processing" });
  const updated = { ...request, status: "resolved", responses: [...(request.responses ?? []), payload.result] };
  const content = appendResistanceRequestResult(message.content, { result: payload.result, consequenceLabel: game.i18n.localize(reroll ? "GUM.RollRequest.RerollRecorded" : "GUM.RollRequest.ResponseRecorded"), purposeLabels: getPurposeLabels(payload.result.purposeIds), userName: sender.name, allowReroll: true, targetKey: payload.targetKey });
  await message.update({ content, "flags.gum.rollRequest": updated });
  return true;
}

async function processChatRollSkip(payload) {
  const message = game.messages.get(payload.messageId);
  if (!message || responsibleGM(message)?.id !== game.user.id) return false;
  const request = foundry.utils.duplicate(message.getFlag("gum", "rollRequest"));
  if (!request?.skip?.allowed || request.id !== payload.requestId || request.status !== "pending") return false;
  const target = request.targets?.find(entry => entry.targetKey === payload.targetKey);
  const resolved = target && await resolveRollRequestTarget(target);
  const sender = game.users.get(payload.userId);
  if (!resolved?.actor || !isUserAuthorizedForTarget(sender, resolved.actor, target)) return false;
  const updated = { ...request, status: "skipped", skippedByUserId: sender.id, skippedAt: Date.now() };
  const content = appendSkippedRequestResult(message.content, { label: request.skip.label });
  await message.update({ content, "flags.gum.rollRequest": updated });
  return true;
}

export function registerRollRequestSocket() {
  game.socket.on("system.gum", payload => {
    if (!["rollRequest:chatResult", "rollRequest:chatSkip"].includes(payload?.type)) return;
    const previous = resultQueues.get(payload.messageId) ?? Promise.resolve();
    const next = previous.then(() => payload.type === "rollRequest:chatSkip" ? processChatRollSkip(payload) : processChatRollResult(payload)).catch(error => { console.error("GUM | Roll request", error); return false; });
    const queued = next.finally(() => { if (resultQueues.get(payload.messageId) === queued) resultQueues.delete(payload.messageId); });
    resultQueues.set(payload.messageId, queued);
  });
}
