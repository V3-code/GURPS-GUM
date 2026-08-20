export function resolveInitialRollBaseKey({ requestedKey = null, baseAttributeKey = null, fixedKey = null, optionKeys = [] } = {}) {
  const available = new Set(optionKeys);
  const requested = requestedKey?.toString?.().trim().toLowerCase();
  if (requested && available.has(requested)) return requested;
  if (baseAttributeKey && available.has(baseAttributeKey)) return baseAttributeKey;
  if (fixedKey && available.has(fixedKey)) return fixedKey;
  return available.has("skill") ? "skill" : optionKeys[0] ?? null;
}