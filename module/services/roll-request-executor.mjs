/**
 * Dependency-injected execution core. Keeping Foundry documents and UI behind
 * adapters makes the request lifecycle testable without a running world.
 */
const localize = (key, fallback) => globalThis.game?.i18n?.localize?.(key) ?? fallback;

export function createRollRequestExecutor({
  normalizeRequest,
  resolveTarget,
  authorize,
  resolveTest,
  performRoll,
  serializeResult,
  createPrompt,
  getCurrentUser
}) {
  const processing = new Set();

  return async function execute(rawRequest, targetKey, { prompt = true, onResult } = {}) {
    const request = normalizeRequest(rawRequest);
    const key = `${request.id}:${targetKey}`;
    if (processing.has(key)) return { accepted: false, reason: "processing" };

    const target = request.targets.find(entry => entry.targetKey === targetKey);
    if (!target) return { accepted: false, reason: "target" };
    const resolvedTarget = await resolveTarget(target);
    if (!resolvedTarget?.actor) return { accepted: false, reason: "target" };
    if (!authorize(getCurrentUser(), resolvedTarget.actor, target)) return { accepted: false, reason: "permission" };

    const resolution = await resolveTest(resolvedTarget.actor, request.test);
    if (!resolution.available) return { accepted: false, reason: resolution.reason };

    const rollData = {
      label: request.title,
      type: resolution.type,
      attributeKey: resolution.attributeKey,
      value: resolution.value,
      itemId: resolution.itemId,
      itemUuid: resolution.itemUuid,
      requestedPurposeIds: request.test.requestedPurposeIds,
      purposeIds: request.test.requestedPurposeIds,
      fixedModifier: request.test.fixedModifier,
      fixedModifierLabel: request.test.fixedModifierLabel || localize("GUM.TestRequest.FixedModifier", "Modificador fixo"),
      defaultLabel: resolution.label,
      initialBaseKey: resolution.type === "attribute" ? (resolution.attributeKey || "fixed") : "skill",
      img: resolvedTarget.actor.img
    };

    processing.add(key);
    const release = () => processing.delete(key);
    const run = async (actor, payload, options = {}) => {
      try {
        const result = await performRoll(actor, payload, { ...options, createChatMessage: false, returnResult: true });
        const serialized = serializeResult(result, { target, resolution });
        await onResult?.(serialized, { request, target, actor, resolution });
        return { accepted: true, result: serialized };
      } finally {
        release();
      }
    };

    if (!prompt) return run(resolvedTarget.actor, { ...rollData, modifier: request.test.fixedModifier });

    try {
      const promptApp = createPrompt(resolvedTarget.actor, rollData, { onRoll: run });
      const originalClose = promptApp.close.bind(promptApp);
      promptApp.close = async (...args) => {
        release();
        return originalClose(...args);
      };
      const rendering = promptApp.render(true);
      if (rendering?.catch) rendering.catch(release);
      return { accepted: true, pending: true };
    } catch (error) {
      release();
      throw error;
    }
  };
}