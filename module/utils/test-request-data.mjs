import { normalizeRollRequest } from "./roll-request-data.mjs";

export function createTestRequest(data = {}, { id = null, userId = null, now = Date.now() } = {}) {
  const common = normalizeRollRequest(data, { id, userId, now });
  const requestId = id ?? data.id ?? `${now}`;
  return { version: 1, id: requestId, status: "open", creatorUserId: userId ?? data.creatorUserId ?? null, createdAt: now,
    title: String(data.title || "Teste solicitado pelo Mestre"), description: String(data.description || ""),
    targets: Array.isArray(data.targets) ? data.targets.map(target => ({ ...target, recipientUserIds: [...new Set(target.recipientUserIds ?? [])] })) : [],
    origin: common.origin, consequence: common.consequence,
    test: common.test,
    delivery: { notifyPlayers: false, ...(data.delivery ?? {}) }, responses: normalizeTestRequestResponses(data.responses, data.targets) };
}

function legacyNestedResponse(responses, targetKey) {
  return String(targetKey ?? "").split(".").reduce((value, part) => value?.[part], responses);
}

export function getTestRequestResponse(request, targetKey) {
  const responses = request?.responses ?? {};
  if (Array.isArray(responses)) return responses.find(response => response?.targetKey === targetKey) ?? null;
  const encodedKey = String(targetKey ?? "").replaceAll("%", "%25").replaceAll(".", "%2E");
  return responses[encodedKey] ?? responses[targetKey] ?? legacyNestedResponse(responses, targetKey);
}

export function normalizeTestRequestResponses(responses = {}, targets = []) {
  const normalized = [];
  for (const target of targets ?? []) {
    const response = getTestRequestResponse({ responses }, target.targetKey);
    if (response) normalized.push({ ...response, targetKey: target.targetKey });
  }
  return normalized;
}

export function insertTestRequestResponse(request, targetKey, response, { replace = false } = {}) {
  if (!request.targets?.some(target => target.targetKey === targetKey)) throw new Error("targetKey inexistente");
  const normalizedResponses = normalizeTestRequestResponses(request.responses, request.targets);
  const previous = getTestRequestResponse({ responses: normalizedResponses }, targetKey);
  if (previous && !replace) throw new Error("resposta duplicada");
  const history = previous ? [...(previous.history ?? []), { ...previous, history: undefined }] : [];
  const otherResponses = normalizedResponses.filter(entry => entry.targetKey !== targetKey);
  return { ...request, responses: [...otherResponses, { ...response, targetKey, history }] };
}

export function getTestRequestProgress(request) {
  const targets = request.targets ?? [];
  return { answered: targets.filter(target => Boolean(getTestRequestResponse(request, target.targetKey))).length, total: targets.length };
}