export function normalizeSkillText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
}

const ATTRIBUTE_ALIASES = new Map([
  ["st", "st"], ["dx", "dx"], ["iq", "iq"], ["ht", "ht"], ["per", "per"],
  ["percepcao", "per"], ["vont", "vont"], ["vontade", "vont"], ["will", "vont"]
]);

function finalAttribute(actor, key) {
  const data = actor?.system?.attributes?.[key];
  const value = Number(data?.final ?? data?.final_computed ?? data?.value);
  return Number.isFinite(value) ? value : null;
}

function actorSkills(actor) {
  return Array.from(actor?.items ?? []).filter(item => item?.type === "skill");
}

function matchingSkill(actor, name, specialization = "") {
  const normalizedName = normalizeSkillText(name);
  const normalizedSpecialization = normalizeSkillText(specialization);
  return actorSkills(actor).find(item => {
    if (normalizeSkillText(item.name) !== normalizedName) return false;
    if (!normalizedSpecialization) return true;
    return normalizeSkillText(item.system?.specialization) === normalizedSpecialization;
  });
}

function ownedResult(item) {
  const value = Number(item?.system?.final_nh);
  if (!Number.isFinite(value)) return null;
  return { available: true, value, sourceType: "skill", sourceName: item.name, modifier: 0,
    itemId: item.id ?? null, itemUuid: item.uuid ?? null, label: `Perícia possuída: ${item.name} = ${value}` };
}

export function resolveSkillDefault(actor, definition = {}, { maxDepth = 8 } = {}) {
  const owned = matchingSkill(actor, definition.skillName, definition.specialization);
  if (owned) return ownedResult(owned);
  if (definition.type === "customSkill") {
    const key = ATTRIBUTE_ALIASES.get(normalizeSkillText(definition.customDefault?.attributeKey));
    const base = key ? finalAttribute(actor, key) : null;
    const modifier = Number(definition.customDefault?.modifier);
    if (base !== null && Number.isFinite(modifier)) return { available: true, value: base + modifier, sourceType: "attribute", sourceName: key.toUpperCase(), modifier, label: `Pré-definido: ${key.toUpperCase()}${modifier >= 0 ? "+" : ""}${modifier} = ${base + modifier}` };
  }
  const slots = Object.values(definition.predefined ?? definition.system?.predefined ?? {}).filter(slot => normalizeSkillText(slot?.name));
  const visited = new Set([`${normalizeSkillText(definition.skillName)}::${normalizeSkillText(definition.specialization)}`]);
  const resolve = (entry, depth) => {
    if (depth > maxDepth) return null;
    const modifier = Number(entry.modifier ?? 0);
    if (!Number.isFinite(modifier)) return null;
    const normalized = normalizeSkillText(entry.name);
    const attributeKey = ATTRIBUTE_ALIASES.get(normalized);
    if (attributeKey) {
      const base = finalAttribute(actor, attributeKey);
      if (base === null) return null;
      return { available: true, value: base + modifier, sourceType: "attribute", sourceName: entry.name, modifier, label: `Pré-definido: ${entry.name}${modifier >= 0 ? "+" : ""}${modifier} = ${base + modifier}` };
    }
    const skill = matchingSkill(actor, entry.name, entry.specialization);
    const direct = ownedResult(skill);
    if (direct) return { ...direct, value: direct.value + modifier, modifier, label: `Pré-definido: ${entry.name}${modifier >= 0 ? "+" : ""}${modifier} = ${direct.value + modifier}` };
    const key = `${normalized}::${normalizeSkillText(entry.specialization)}`;
    if (visited.has(key)) return null;
    const canonical = actorSkills(actor).find(item => normalizeSkillText(item.name) === normalized);
    if (!canonical?.system?.predefined) return null;
    visited.add(key);
    const candidates = Object.values(canonical.system.predefined).map(next => resolve(next, depth + 1)).filter(Boolean);
    visited.delete(key);
    if (!candidates.length) return null;
    const best = candidates.sort((a, b) => b.value - a.value)[0];
    return { ...best, value: best.value + modifier, modifier: best.modifier + modifier };
  };
  const candidates = slots.map(entry => resolve(entry, 0)).filter(Boolean).sort((a, b) => b.value - a.value);
  return candidates[0] ?? { available: false, reason: "O personagem não possui a perícia nem um pré-definido válido." };
}