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

export function getRequestedAttributeOption(key) {
  const normalizedKey = String(key ?? "").trim().toLowerCase();
  return REQUESTED_ATTRIBUTE_OPTIONS.find(option => option.key === normalizedKey) ?? null;
}

export function resolveRequestedAttribute(attributes = {}, key) {
  const option = getRequestedAttributeOption(key);
  const attributeKey = option?.key ?? String(key ?? "").trim().toLowerCase();
  const attribute = attributes?.[attributeKey];
  const value = Number(attribute?.final ?? attribute?.value);
  if (!Number.isFinite(value)) return { available: false, reason: "O atributo solicitado não está disponível." };
  return {
    available: true,
    value,
    label: option?.label ?? attributeKey.toUpperCase(),
    type: option?.rollType ?? "attribute",
    attributeKey,
    ...(option?.defenseType ? { defenseType: option.defenseType } : {})
  };
}
