const DEFENSE_TYPES = new Set(["dodge", "parry", "block"]);

function searchable(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Prefer the stable machine value supplied by the UI. Label matching remains
 * only as compatibility for callers created before defense types were explicit.
 */
export function resolveDefenseRollType(value, label = "") {
  const explicit = searchable(value);
  if (DEFENSE_TYPES.has(explicit)) return explicit;

  const text = `${explicit} ${searchable(label)}`.trim();
  if (/\b(dodge|esquiva|esq)\b/.test(text)) return "dodge";
  if (/\b(parry|aparar|apar)\b/.test(text)) return "parry";
  if (/\b(block|bloqueio|bloq)\b/.test(text)) return "block";
  return null;
}
