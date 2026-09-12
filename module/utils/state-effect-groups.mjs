export const STATE_EFFECT_MODES = Object.freeze({
  MANUAL: "manual",
  EQUIPPED: "equipped",
  CARRIED: "carried",
  PRESENT: "present",
  EQUIPPED_MANUAL: "equipped_manual"
});

export function normalizeStateEffectMode(mode) {
  return Object.values(STATE_EFFECT_MODES).includes(mode) ? mode : STATE_EFFECT_MODES.MANUAL;
}

export function normalizeStateEffectGroup(id, group = {}) {
  return {
    id: group.id || id,
    name: String(group.name || "Grupo de efeitos").trim() || "Grupo de efeitos",
    mode: normalizeStateEffectMode(group.mode),
    active: group.active === true,
    exclusiveSet: String(group.exclusiveSet || "").trim(),
    effects: group.effects && typeof group.effects === "object" ? group.effects : {}
  };
}

export function getStateEffectGroups(itemOrSystem) {
  const system = itemOrSystem?.system || itemOrSystem || {};
  return Object.entries(system.stateEffectGroups || {}).map(([id, group]) => normalizeStateEffectGroup(id, group));
}

export function isStateEffectGroupDesired(group, itemSystem = {}) {
  const normalized = normalizeStateEffectGroup(group?.id, group);
  const equipped = itemSystem.equipped === true || itemSystem.location === "equipped";
  const carried = equipped || itemSystem.location === "carried" || (itemSystem.stored !== true && !itemSystem.location);
  switch (normalized.mode) {
    case STATE_EFFECT_MODES.PRESENT: return true;
    case STATE_EFFECT_MODES.EQUIPPED: return equipped;
    case STATE_EFFECT_MODES.CARRIED: return carried && itemSystem.stored !== true;
    case STATE_EFFECT_MODES.EQUIPPED_MANUAL: return equipped && normalized.active;
    default: return normalized.active;
  }
}

export function isManualStateEffectMode(mode) {
  return [STATE_EFFECT_MODES.MANUAL, STATE_EFFECT_MODES.EQUIPPED_MANUAL].includes(normalizeStateEffectMode(mode));
}

export function normalizeExclusiveSet(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

export function buildExclusiveGroupUpdates(groups, activatedGroupId) {
  const activated = groups.find(group => group.id === activatedGroupId);
  const exclusiveSet = normalizeExclusiveSet(activated?.exclusiveSet);
  if (!exclusiveSet) return {};
  return Object.fromEntries(groups
    .filter(group => group.id !== activatedGroupId
      && isManualStateEffectMode(group.mode)
      && normalizeExclusiveSet(group.exclusiveSet) === exclusiveSet
      && group.active)
    .map(group => [`system.stateEffectGroups.${group.id}.active`, false]));
}