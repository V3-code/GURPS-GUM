import { normalizePurposeIds } from "./roll-purposes.mjs";

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalNonNegativeNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
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
      minimumMargin: Math.max(0, numberOr(config.minimumMargin ?? config.margin, 0))      ,
      mode: config.mode === "conditional" ? "conditional" : "simple",
      branches: normalizeBarrierBranches(config.branches)
    },
    chatText: String(config.chatText ?? ""),
    skipPromptCard: config.skipPromptCard === true,
    isResisted: config.isResisted === true
  };
}

export function normalizeBarrierBranches(branches = []) {
  if (!Array.isArray(branches)) return [];
  let hasOtherwise = false;
  const normalized = branches.flatMap((branch, index) => {
    if (!branch || typeof branch !== "object") return [];
    const rawType = branch.condition?.type ?? branch.type;
    const type = rawType === "otherwise" ? "otherwise" : "outcome";
    if (type === "otherwise" && hasOtherwise) return [];
    if (type === "otherwise") hasOtherwise = true;
    const outcome = (branch.condition?.outcome ?? branch.outcome) === "success" ? "success" : "failure";
    const rawActionIds = Array.isArray(branch.actionIds) ? branch.actionIds : String(branch.actionIds ?? "").split(",");
    const actionIds = [...new Set(rawActionIds.map(id => String(id).trim()).filter(Boolean))];
    const minimumMargin = Math.max(0, numberOr(branch.condition?.minimumMargin ?? branch.minimumMargin, 0));
    const rawMaximumMargin = optionalNonNegativeNumber(branch.condition?.maximumMargin ?? branch.maximumMargin);
    const maximumMargin = rawMaximumMargin === null ? null : Math.max(minimumMargin, rawMaximumMargin);
    return [{
      id: String(branch.id || `branch-${index + 1}`),
      label: String(branch.label || (type === "otherwise" ? "Nenhuma outra condição" : outcome === "success" ? "Sucesso" : "Falha")),
      condition: {
        type,
        outcome,
        minimumMargin,
        maximumMargin
      },
      actionIds
    }];
  });
  return [...normalized.filter(branch => branch.condition.type !== "otherwise"), ...normalized.filter(branch => branch.condition.type === "otherwise")];
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
  if (consequence.mode === "conditional") {
    const branches = normalizeBarrierBranches(consequence.branches);
    const matchedBranches = branches.filter(branch => branch.condition.type !== "otherwise" && (
      (branch.condition.outcome === "success" ? success : !success)
      && achievedMargin >= branch.condition.minimumMargin
      && (branch.condition.maximumMargin === null || achievedMargin <= branch.condition.maximumMargin)
    ));
    if (matchedBranches.length === 0) {
      const fallback = branches.find(branch => branch.condition.type === "otherwise");
      if (fallback) matchedBranches.push(fallback);
    }
    const actionIds = [...new Set(matchedBranches.flatMap(branch => branch.actionIds))];
    const firstBranch = matchedBranches[0] ?? null;
    return {
      shouldApply: matchedBranches.length > 0, success, achievedMargin,
      minimumMargin: firstBranch?.condition.minimumMargin ?? 0,
      applyOn: firstBranch?.condition.outcome ?? null,
      branchId: firstBranch?.id ?? null, branchLabel: firstBranch?.label ?? null,
      branchIds: matchedBranches.map(branch => branch.id),
      branchLabels: matchedBranches.map(branch => branch.label),
      actionIds
    };
  }
  return { shouldApply: achievedMargin >= minimumMargin && (applyOn === "success" ? success : !success), success, achievedMargin, minimumMargin, applyOn, branchId: null, branchLabel: null, branchIds: [], branchLabels: [], actionIds: null };
}

export function isMatchingDamageResistance(application, { targetActorId, effectLinkId, effectUuid } = {}) {
  if (!application || application.isDialogClosed || application.targetActor?.id !== targetActorId) return false;
  const effect = application.availableOnDamageEffects?.find(entry => entry.id === effectLinkId);
  return Boolean(effect && effect.item?.uuid === effectUuid);
}