import { getBodyLocationDefinition, getBodyProfile, getBodyProfileLocationKeys } from "../config/body-profiles.js";

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function hasVisibleDamageResistance(value) {
  return value && typeof value === "object" && Object.keys(value).length > 0;
}

export function normalizeAdditionalBodyLocations(value = {}) {
  if (!value || typeof value !== "object") return {};
  const entries = Array.isArray(value)
    ? value.map(entry => [entry?.id || entry?.key, entry])
    : Object.entries(value);
  const normalized = {};
  for (const [rawKey, rawDefinition] of entries) {
    const key = String(rawKey || "").trim();
    if (!key || key === "all") continue;
    const known = getBodyLocationDefinition(key);
    const definition = rawDefinition && typeof rawDefinition === "object" ? rawDefinition : {};
    const label = String(definition.label ?? definition.name ?? known?.label ?? known?.name ?? key).trim();
    if (!label) continue;
    normalized[key] = {
      ...(known ? clone(known) : {}),
      ...clone(definition),
      name: label,
      label,
      roll: String(definition.roll ?? known?.roll ?? "--").trim() || "--"
    };
  }
  return normalized;
}

/**
 * Compose the actor's effective anatomy from its profile, explicit additions,
 * and recognized locations supplied by currently equipped equipment.
 */
export function buildEffectiveBodyLocations({ profile: profileOrId = "humanoid", additionalLocations = {}, equipment = [] } = {}) {
  const profile = typeof profileOrId === "string" ? getBodyProfile(profileOrId) : profileOrId;
  const profileKeys = getBodyProfileLocationKeys(profile);
  const definitions = {};
  const sources = {};
  const order = [];
  const seen = new Set();

  const add = (key, definition, source) => {
    if (!key || key === "all" || !definition) return;
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
      definitions[key] = clone(definition);
      sources[key] = [];
    }
    if (source && !sources[key].some(entry => entry.type === source.type && entry.id === source.id)) {
      sources[key].push(source);
    }
  };

  for (const key of profileKeys) add(key, profile.locations?.[key], { type: "profile", id: profile.id, name: profile.label });

  const normalizedAdditional = normalizeAdditionalBodyLocations(additionalLocations);
  for (const [key, definition] of Object.entries(normalizedAdditional)) {
    add(key, definition, { type: "manual", id: key, name: definition.label });
  }

  for (const item of equipment || []) {
    if (item?.type !== "equipment") continue;
    const system = item.system || item._source?.system || {};
    const equipped = system.location === "equipped" || system.equipped === true;
    if (!equipped) continue;
    const options = system.dr_location_options || {};
    for (const [key, dr] of Object.entries(system.dr_locations || {})) {
      if (key === "all" || !hasVisibleDamageResistance(dr)) continue;
      if (options?.[key]?.provides_location === false) continue;
      const definition = getBodyLocationDefinition(key);
      if (!definition) continue;
      add(key, definition, { type: "equipment", id: item.id || item._id || key, name: item.name || key });
    }
  }

  return { order, definitions, sources, additionalLocations: normalizedAdditional };
}

export function describeBodyLocationSources(sourceList = []) {
  if (sourceList.some(source => source?.type === "profile" || source?.type === "manual")) return [];
  return sourceList
    .filter(source => source?.type === "equipment")
    .map(source => source.name)
    .filter(Boolean);
}
