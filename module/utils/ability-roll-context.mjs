import { normalizeRequestedAttributeKey } from "./requested-attributes.mjs";

export const ABILITY_ITEM_TYPES = Object.freeze(["skill", "spell", "power"]);
export const ABILITY_ATTRIBUTE_KEYS = Object.freeze(["st", "dx", "iq", "ht", "per", "vont"]);

export function resolveAbilityRollContext(type, { attributeKey = null, item = null } = {}) {
  const normalizedType = String(type ?? item?.type ?? "").trim().toLowerCase();
  if (!ABILITY_ITEM_TYPES.includes(normalizedType)) return null;

  const rawAttribute = attributeKey ?? item?.system?.base_attribute;
  const normalizedAttribute = normalizeRequestedAttributeKey(rawAttribute);
  const storedType = String(item?.system?.base_attribute_type ?? "attribute").trim().toLowerCase();
  const isDirectAttribute = attributeKey != null || storedType === "attribute";
  if (isDirectAttribute && ABILITY_ATTRIBUTE_KEYS.includes(normalizedAttribute)) {
    return `${normalizedType}_${normalizedAttribute}`;
  }
  return normalizedType;
}

export function matchesAbilityRollContext(filter, actualContext) {
  const requested = String(filter ?? "").trim().toLowerCase();
  const actual = String(actualContext ?? "").trim().toLowerCase();
  if (!requested || requested === "all") return true;
  if (requested === "attack") return actual.startsWith("attack");
  if (requested === "defense") return actual.startsWith("defense");
  if (requested === "check") return actual.startsWith("check_") || actual.startsWith("sense_");
  if (ABILITY_ITEM_TYPES.includes(requested)) return actual === requested || actual.startsWith(`${requested}_`);
  return requested === actual;
}

function normalizeClassificationValue(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function csvValues(value) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values
    .flatMap(entry => String(entry ?? "").split(","))
    .map(normalizeClassificationValue)
    .filter(Boolean))];
}

export function resolveAbilitySheetGroup(item = null, actor = null) {
  const abilityType = String(item?.type ?? "").trim().toLowerCase();
  if (!ABILITY_ITEM_TYPES.includes(abilityType)) return "";
  const owner = actor ?? item?.actor ?? item?.parent;
  const organization = owner?.system?.[`${abilityType}_organization`];
  const itemId = String(item?.id ?? item?._id ?? "").trim();
  const groupId = itemId ? String(organization?.assignments?.[itemId] ?? "").trim() : "";
  return groupId ? String(organization?.groups?.[groupId]?.name ?? "").trim() : "";
}

export function matchesAbilityClassificationFilters(entry = {}, item = null, { actor = null } = {}) {
  const filters = [
    ["ability_sources", item?.system?.source],
    ["ability_groups", item?.system?.group],
    ["ability_sheet_groups", resolveAbilitySheetGroup(item, actor)],
    ["ability_schools", item?.system?.spell_school],
    ["ability_classes", item?.system?.spell_class]
  ];
  for (const [field, itemValue] of filters) {
    const accepted = csvValues(entry?.[field]);
    if (!accepted.length) continue;
    if (!item || !accepted.includes(normalizeClassificationValue(itemValue))) return false;
  }
  return true;
}
