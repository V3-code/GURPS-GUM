const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const textOrNull = value => {
  const text = String(value ?? "").trim();
  return text || null;
};

const optionalFiniteNumber = value => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export function classifyDamageTargetPool(path) {
  const normalized = String(path ?? "").trim();
  if (normalized === "system.attributes.hp.value") return "hp";
  if (normalized === "system.attributes.fp.value") return "fp";
  if (normalized.startsWith("system.combat.combat_meters.")) return "combat-meter";
  if (normalized.startsWith("system.spell_reserves.")) return "spell-reserve";
  if (normalized.startsWith("system.power_reserves.")) return "power-reserve";
  if (normalized.startsWith("equipment-integrity:")) return "equipment-integrity";
  if (normalized.startsWith("equipment:")) return "equipment-reserve";
  return "other";
}

/** GURPS B419: ordinary characters suffer one point of shock per HP lost.
 * At 20+ maximum HP, each point of shock requires HP/10 injury, dropping fractions.
 */
export function calculateShockPenalty(injury, maximumHP) {
  const appliedInjury = Math.max(0, Math.floor(finiteNumber(injury)));
  const hp = Math.max(0, finiteNumber(maximumHP));
  const injuryPerPoint = hp >= 20 ? Math.max(1, Math.floor(hp / 10)) : 1;
  return Math.min(4, Math.floor(appliedInjury / injuryPerPoint));
}

/** Build the plain-data pulse passed through Actor.update options.
 * Keep legacy aliases while exposing structured data for new passive conditions.
 */
export function buildDamageApplicationEvent({
  eventId = null,
  applicationId = null,
  damage = {},
  targetPool = {},
  hitLocation = {},
  protection = {},
  source = {},
  target = {},
  combat = null
} = {}) {
  const poolPath = String(targetPool.path ?? "").trim();
  const poolKind = targetPool.kind || classifyDamageTargetPool(poolPath);
  const injury = Math.max(0, finiteNumber(damage.injury ?? damage.total));
  const damageType = textOrNull(damage.type);
  const hitLocationKey = textOrNull(hitLocation.key);
  const before = finiteNumber(targetPool.before);
  const after = finiteNumber(targetPool.after, before - injury);
  const appliedToHP = poolKind === "hp";

  return {
    version: 2,
    pulse: true,
    type: "damage",
    reason: "damageApplication",
    eventId: textOrNull(eventId),
    applicationId: textOrNull(applicationId),
    damage: {
      total: injury,
      value: injury,
      amount: injury,
      rolled: Math.max(0, finiteNumber(damage.rolled)),
      modified: Math.max(0, finiteNumber(damage.modified ?? damage.rolled)),
      penetrating: Math.max(0, finiteNumber(damage.penetrating)),
      injury,
      type: damageType,
      nature: textOrNull(damage.nature),
      natureLabel: textOrNull(damage.natureLabel),
      armorDivisor: Math.max(0, finiteNumber(damage.armorDivisor, 1)),
      woundingModifier: finiteNumber(damage.woundingModifier, 1),
      component: textOrNull(damage.component),
      shockPenalty: Math.max(0, Math.floor(finiteNumber(damage.shockPenalty))),
      modifiers: { ...(damage.modifiers || {}) }
    },
    targetPool: {
      kind: poolKind,
      path: poolPath,
      label: textOrNull(targetPool.label),
      before,
      after,
      applied: Math.max(0, finiteNumber(targetPool.applied, injury)),
      maximum: optionalFiniteNumber(targetPool.maximum)
    },
    hitLocation: {
      profileId: textOrNull(hitLocation.profileId),
      key: hitLocationKey,
      groupKey: textOrNull(hitLocation.groupKey),
      label: textOrNull(hitLocation.label),
      roll: textOrNull(hitLocation.roll),
      custom: hitLocation.custom === true,
      grouped: hitLocation.grouped === true,
      largeArea: hitLocation.largeArea === true,
      markedKey: textOrNull(hitLocation.markedKey),
      markedLabel: textOrNull(hitLocation.markedLabel)
    },
    protection: {
      rawDR: Math.max(0, finiteNumber(protection.rawDR)),
      effectiveDR: Math.max(0, finiteNumber(protection.effectiveDR)),
      ignored: protection.ignored === true
    },
    source: {
      actorUuid: textOrNull(source.actorUuid),
      tokenUuid: textOrNull(source.tokenUuid),
      itemUuid: textOrNull(source.itemUuid),
      attackId: textOrNull(source.attackId),
      attackType: textOrNull(source.attackType),
      name: textOrNull(source.name)
    },
    target: {
      actorUuid: textOrNull(target.actorUuid),
      tokenUuid: textOrNull(target.tokenUuid)
    },
    combat: combat ? {
      id: textOrNull(combat.id),
      round: optionalFiniteNumber(combat.round),
      turn: optionalFiniteNumber(combat.turn)
    } : null,
    appliedToHP,
    poolPath,
    injury,
    damageType,
    hitLocationKey,
    hpBefore: appliedToHP ? before : null,
    hpAfter: appliedToHP ? after : null,
    hpMaximum: appliedToHP ? optionalFiniteNumber(targetPool.maximum) : null
  };
}
