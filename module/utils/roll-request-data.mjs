import { normalizePurposeIds } from "./roll-purposes.mjs";

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeRollTest(test = {}) {
  const legacyKey = String(test.attributeKey ?? test.attribute ?? test.roll_attribute ?? "ht").trim();
  const normalizedLegacyKey = legacyKey.toLowerCase();
  const attributeKeys = new Set(["st", "dx", "iq", "ht", "per", "vont", "will", "vontade", "percepcao", "percepção"]);
  let type = test.type ?? test.testType;
  if (!type) type = normalizedLegacyKey === "fixed" ? "fixed" : attributeKeys.has(normalizedLegacyKey) ? "attribute" : "skill";
  if (type === "custom-skill") type = "customSkill";
  const skillName = test.skillName ?? (type === "skill" && !test.skillUuid ? legacyKey : null);
  return {
    type,
    attributeKey: String(test.attributeKey ?? (legacyKey !== "fixed" ? legacyKey : "ht")).toLowerCase(),
    skillUuid: test.skillUuid ?? null,
    skillName,
    specialization: test.specialization ?? "",
    sourceId: test.sourceId ?? null,
    customDefault: test.customDefault ?? null,
    fixedValue: type === "fixed" ? numberOr(test.fixedValue ?? test.roll_fixed_value, 10) : null,
    requestedPurposeIds: normalizePurposeIds(test.requestedPurposeIds ?? test.purposeIds),
    fixedModifier: numberOr(test.fixedModifier ?? test.modifier ?? test.roll_modifier, 0),
    fixedModifierLabel: String(test.fixedModifierLabel ?? test.modifierLabel ?? "")
  };
}

export function normalizeResistanceRoll(config = {}) {
  const test = normalizeRollTest(config);
  return {
    test,
    consequence: {
      type: "effect-barrier",
      applyOn: config.applyOn === "success" ? "success" : "failure",
      minimumMargin: Math.max(0, numberOr(config.minimumMargin ?? config.margin, 0))
    },
    chatText: String(config.chatText ?? ""),
    skipPromptCard: config.skipPromptCard === true,
    isResisted: config.isResisted === true
  };
}

export function normalizeChatRoll(action = {}) {
  return {
    test: normalizeRollTest({
      ...action,
      type: action.roll_type,
      attributeKey: action.roll_attribute,
      skillUuid: action.roll_skill_uuid,
      skillName: action.roll_skill_name,
      customDefault: action.roll_custom_default,
      fixedValue: action.roll_fixed_value,
      requestedPurposeIds: action.requestedPurposeIds ?? action.roll_requested_purpose_ids,
      fixedModifier: action.roll_modifier,
      fixedModifierLabel: action.roll_modifier_label
    }),
    label: String(action.roll_label || "Rolar Teste"),
    whisperMode: action.whisperMode || "public"
  };
}

export function normalizeRollRequest(data = {}, { id = null, userId = null, now = Date.now() } = {}) {
  return {
    version: 1,
    id: id ?? data.id ?? String(now),
    status: data.status ?? "pending",
    creatorUserId: userId ?? data.creatorUserId ?? null,
    createdAt: data.createdAt ?? now,
    title: String(data.title || "Teste"),
    description: String(data.description || ""),
    origin: { type: "manual-request", sourceActorUuid: null, sourceItemUuid: null, effectUuid: null, effectLinkId: null, ...(data.origin ?? {}) },
    targets: Array.isArray(data.targets) ? data.targets.map(target => ({ ...target, recipientUserIds: [...new Set(target.recipientUserIds ?? [])] })) : [],
    test: normalizeRollTest(data.test),
    consequence: { type: "record-response", applyOn: null, minimumMargin: 0, ...(data.consequence ?? {}) },
    delivery: { rollMode: null, notifyPlayers: false, ...(data.delivery ?? {}) },
    responses: Array.isArray(data.responses) ? data.responses : []
  };
}

export function evaluateBarrierConsequence(result, consequence = {}) {
  const success = result?.outcome === "success" || result?.outcome === "critical-success" || result?.isSuccess === true;
  const achievedMargin = Math.abs(numberOr(result?.margin, 0));
  const minimumMargin = Math.max(0, numberOr(consequence.minimumMargin ?? consequence.margin, 0));
  const applyOn = consequence.applyOn === "success" ? "success" : "failure";
  return { shouldApply: achievedMargin >= minimumMargin && (applyOn === "success" ? success : !success), success, achievedMargin, minimumMargin, applyOn };
}

export function isMatchingDamageResistance(application, { targetActorId, effectLinkId, effectUuid } = {}) {
  if (!application || application.isDialogClosed || application.targetActor?.id !== targetActorId) return false;
  const effect = application.availableOnDamageEffects?.find(entry => entry.id === effectLinkId);
  return Boolean(effect && effect.item?.uuid === effectUuid);
}