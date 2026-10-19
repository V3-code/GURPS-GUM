export const REQUESTED_ATTRIBUTE_OPTIONS = Object.freeze([
  { key: "st", label: "ST", rollType: "attribute" },
  { key: "dx", label: "DX", rollType: "attribute" },
  { key: "iq", label: "IQ", rollType: "attribute" },
  { key: "ht", label: "HT", rollType: "attribute" },
  { key: "per", label: "Per", rollType: "attribute" },
  { key: "vont", label: "Vont", rollType: "attribute" },
  { key: "vision", label: "Visão", rollType: "skill" },
  { key: "hearing", label: "Audição", rollType: "skill" },
  { key: "tastesmell", label: "Paladar/Olfato", rollType: "skill" },
  { key: "touch", label: "Tato", rollType: "skill" },
  { key: "dodge", label: "Esquiva", rollType: "defense", defenseType: "dodge" }
]);

export const REQUESTED_ATTRIBUTE_KEYS = new Set(REQUESTED_ATTRIBUTE_OPTIONS.map(option => option.key));

const REQUESTED_ATTRIBUTE_ALIASES = new Map([
  ["st", "st"], ["str", "st"], ["strength", "st"], ["forca", "st"],
  ["dx", "dx"], ["dex", "dx"], ["dexterity", "dx"], ["destreza", "dx"],
  ["iq", "iq"], ["int", "iq"], ["intelligence", "iq"], ["inteligencia", "iq"],
  ["ht", "ht"], ["health", "ht"], ["saude", "ht"],
  ["per", "per"], ["perception", "per"], ["percepcao", "per"],
  ["vont", "vont"], ["vontade", "vont"], ["will", "vont"], ["willpower", "vont"],
  ["vision", "vision"], ["sight", "vision"], ["visao", "vision"],
  ["hearing", "hearing"], ["audition", "hearing"], ["audicao", "hearing"],
  ["tastesmell", "tastesmell"], ["taste", "tastesmell"], ["smell", "tastesmell"], ["paladarolfato", "tastesmell"],
  ["touch", "touch"], ["tato", "touch"],
  ["dodge", "dodge"], ["esquiva", "dodge"]
]);

const normalizeAttributeAlias = (value) => String(value ?? "")
  .trim()
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "");

export function normalizeRequestedAttributeKey(key) {
  const rawKey = String(key ?? "").trim();
  const alias = normalizeAttributeAlias(rawKey);
  return REQUESTED_ATTRIBUTE_ALIASES.get(alias) ?? rawKey.toLowerCase();
}

export function getRequestedAttributeOption(key) {
  const normalizedKey = normalizeRequestedAttributeKey(key);
  return REQUESTED_ATTRIBUTE_OPTIONS.find(option => option.key === normalizedKey) ?? null;
}

export function resolveRequestedAttribute(attributes = {}, key) {
  const option = getRequestedAttributeOption(key);
  const attributeKey = option?.key ?? normalizeRequestedAttributeKey(key);
  const attribute = attributes?.[attributeKey];
  const hasFinalValue = attribute?.final !== null && attribute?.final !== undefined && attribute?.final !== "";
  const value = Number(hasFinalValue ? attribute.final : attribute?.value);
  if (!Number.isFinite(value)) return { available: false, reason: "O atributo solicitado não está disponível." };
  return {
    available: true,
    value,
    label: option?.label ?? attributeKey.toUpperCase(),
    type: option?.rollType ?? "attribute",
    attributeKey,
    ...(option?.defenseType ? {
      defenseType: option.defenseType,
      defenseBonusIncluded: hasFinalValue
    } : {})
  };
}
