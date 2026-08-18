export const ROLL_PURPOSE_GROUPS = Object.freeze([
  { id: "general", label: "Geral" },
  { id: "survival", label: "Ferimentos e Sobrevivência" },
  { id: "resistances", label: "Resistências" },
  { id: "mental", label: "Mentais" },
  { id: "senses", label: "Sensoriais" }
]);

export const ROLL_PURPOSES = [
  { id: "general", label: "Teste Geral", shortLabel: "Teste Geral", group: "general", tags: [], suggestedAttributes: [], description: "Teste sem uma finalidade específica." },
  { id: "knockdown_stun", label: "Nocaute/Atordoamento", shortLabel: "Nocaute/Atordoamento", group: "survival", tags: ["knockdown", "stun", "injury"], suggestedAttributes: ["ht"], description: "Teste para evitar nocaute ou atordoamento por ferimentos." },
  { id: "consciousness", label: "Consciência", shortLabel: "Consciência", group: "survival", tags: ["unconsciousness"], suggestedAttributes: ["ht"], description: "Teste para permanecer consciente." },
  { id: "death", label: "Morte", shortLabel: "Morte", group: "survival", tags: ["death", "survival"], suggestedAttributes: ["ht"], description: "Teste de sobrevivência contra a morte." },
  { id: "pain", label: "Dor", shortLabel: "Dor", group: "survival", tags: ["pain"], suggestedAttributes: ["ht", "vont"], description: "Teste relacionado a dor." },
  { id: "resist_poison", label: "Resistência a Veneno", shortLabel: "Veneno", group: "resistances", tags: ["resistance", "poison"], suggestedAttributes: ["ht"], description: "Teste para resistir aos efeitos de venenos e toxinas." },
  { id: "resist_disease", label: "Resistência a Doença", shortLabel: "Doença", group: "resistances", tags: ["resistance", "disease"], suggestedAttributes: ["ht"], description: "Teste para resistir a doenças." },
  { id: "resist_paralysis", label: "Resistência a Paralisia", shortLabel: "Paralisia", group: "resistances", tags: ["resistance", "paralysis", "incapacitation"], suggestedAttributes: ["ht"], description: "Teste para resistir à paralisia." },
  { id: "resist_incapacitation", label: "Resistência à Incapacitação", shortLabel: "Incapacitação", group: "resistances", tags: ["resistance", "incapacitation"], suggestedAttributes: ["ht"], description: "Teste para resistir à incapacitação." },
  { id: "fright_check", label: "Verificação de Pânico", shortLabel: "Pânico", group: "mental", tags: ["resistance", "fright", "fear"], suggestedAttributes: ["vont"], description: "Verificação de pânico ou choque mental." },
  { id: "resist_fear", label: "Resistência ao Medo", shortLabel: "Medo", group: "mental", tags: ["resistance", "fear"], suggestedAttributes: ["vont"], description: "Teste para resistir ao medo." },
  { id: "resist_intimidation", label: "Resistência à Intimidação", shortLabel: "Intimidação", group: "mental", tags: ["resistance", "intimidation"], suggestedAttributes: ["vont"], description: "Teste para resistir à intimidação." },
  { id: "sense_vision", label: "Visão", shortLabel: "Visão", group: "senses", tags: ["vision"], suggestedAttributes: ["per"], description: "Teste de visão." },
  { id: "sense_hearing", label: "Audição", shortLabel: "Audição", group: "senses", tags: ["hearing"], suggestedAttributes: ["per"], description: "Teste de audição." },
  { id: "sense_taste_smell", label: "Paladar/Olfato", shortLabel: "Paladar/Olfato", group: "senses", tags: ["taste", "smell"], suggestedAttributes: ["per"], description: "Teste de paladar ou olfato." },
  { id: "sense_touch", label: "Tato", shortLabel: "Tato", group: "senses", tags: ["touch"], suggestedAttributes: ["per"], description: "Teste de tato." }
];

const PURPOSE_BY_ID = new Map(ROLL_PURPOSES.map((purpose) => [purpose.id, purpose]));

export function registerRollPurpose(purpose) {
  if (!purpose?.id || !purpose?.label || !purpose?.group) throw new Error("Finalidade inválida: id, label e group são obrigatórios.");
  const normalized = {
    ...purpose,
    id: String(purpose.id).trim(),
    tags: normalizeRollTags(purpose.tags),
    suggestedAttributes: normalizeRollTags(purpose.suggestedAttributes),
    description: String(purpose.description || "")
  };
  const previous = PURPOSE_BY_ID.get(normalized.id);
  if (previous) ROLL_PURPOSES.splice(ROLL_PURPOSES.indexOf(previous), 1, normalized);
  else ROLL_PURPOSES.push(normalized);
  PURPOSE_BY_ID.set(normalized.id, normalized);
  return normalized;
}

export function normalizePurposeIds(value) {
  const values = Array.isArray(value) ? value : value ? String(value).split(",") : [];
  const ids = [...new Set(values.map((id) => String(id).trim()).filter((id) => id && id !== "general" && PURPOSE_BY_ID.has(id)))];
  return ids;
}

export function resolveRollMetadata({ context = "default", purposeIds = [], attributeKey = null } = {}) {
  const normalizedPurposeIds = normalizePurposeIds(purposeIds);
  const rollTags = [...new Set(normalizedPurposeIds.flatMap((id) => PURPOSE_BY_ID.get(id)?.tags || []))];
  return { context: String(context || "default"), purposeIds: normalizedPurposeIds, rollTags, attributeKey: attributeKey ? String(attributeKey).toLowerCase() : null };
}

export function normalizeRollTags(value) {
  const values = Array.isArray(value) ? value : value ? String(value).split(",") : [];
  return [...new Set(values.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
}

export function matchesRollTags(filter, rollTags = []) {
  const required = normalizeRollTags(filter?.roll_tags ?? filter?.rollTags);
  if (!required.length) return true;
  const present = new Set(normalizeRollTags(rollTags));
  return String(filter?.roll_tag_match ?? filter?.rollTagMatch ?? "any").toLowerCase() === "all"
    ? required.every((tag) => present.has(tag))
    : required.some((tag) => present.has(tag));
}

export function shouldIncludeInPermanentNh(entry = {}) {
  return String(entry.nh_display_mode || "roll_only") === "include_in_nh"
    && normalizeRollTags(entry.roll_tags ?? entry.rollTags).length === 0;
}

export function getPurposeLabels(purposeIds = [], { short = false } = {}) {
  return normalizePurposeIds(purposeIds).map((id) => short ? PURPOSE_BY_ID.get(id).shortLabel : PURPOSE_BY_ID.get(id).label);
}

export function getGroupedRollPurposes(attributeKey = null, selectedIds = []) {
  const selected = new Set(normalizePurposeIds(selectedIds));
  return ROLL_PURPOSE_GROUPS.map((group) => ({
    ...group,
    purposes: ROLL_PURPOSES.filter((purpose) => purpose.group === group.id).map((purpose) => ({
      ...purpose,
      selected: purpose.id === "general" ? selected.size === 0 : selected.has(purpose.id),
      suggested: Boolean(attributeKey && purpose.suggestedAttributes.includes(String(attributeKey).toLowerCase())),
      tooltip: `${purpose.description}${purpose.suggestedAttributes.length ? ` Atributo usual: ${purpose.suggestedAttributes.map((key) => key === "vont" ? "Vont" : key.toUpperCase()).join("/")}.` : ""}`
    }))
  }));
}