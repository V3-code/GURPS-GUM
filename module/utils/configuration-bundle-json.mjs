import {
  GUM_ITEM_BUNDLE_FORMAT,
  GUM_ITEM_BUNDLE_VERSION,
  prepareItemBundle
} from "./item-bundle-json.mjs";

export const GUM_CONFIGURATION_BUNDLE_FORMAT = "gum-configuration-bundle";
export const GUM_CONFIGURATION_BUNDLE_VERSION = 1;
export const GUM_CONFIGURATION_BUNDLE_KINDS = Object.freeze(["gm-screen", "world-statuses"]);

const KIND_SET = new Set(GUM_CONFIGURATION_BUNDLE_KINDS);
const ALLOWED_TYPES = Object.freeze({
  "gm-screen": new Set(["effect", "gm_modifier"]),
  "world-statuses": new Set(["effect"])
});

const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const clone = value => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function validateDocuments(documents, kind) {
  const normalized = {};
  for (const [rawKey, rawDocument] of Object.entries(documents || {})) {
    const key = requiredText(rawKey, "Configuration bundle document key");
    if (!isObject(rawDocument)) throw new Error(`Configuration bundle document "${key}" must be an object.`);
    const name = requiredText(rawDocument.name, `Configuration bundle document "${key}" name`);
    const type = requiredText(rawDocument.type, `Configuration bundle document "${key}" type`);
    if (!ALLOWED_TYPES[kind].has(type)) {
      throw new Error(`Configuration bundle kind "${kind}" does not support Item type "${type}" at "${key}".`);
    }
    if (!isObject(rawDocument.system)) {
      throw new Error(`Configuration bundle document "${key}" must contain a system object.`);
    }
    normalized[key] = { ...clone(rawDocument), name, type };
  }
  return normalized;
}

/** Return a normalized configuration bundle, or null for another JSON format. */
export function parseConfigurationBundle(data) {
  if (!data || data.format !== GUM_CONFIGURATION_BUNDLE_FORMAT) return null;
  if (data.version !== GUM_CONFIGURATION_BUNDLE_VERSION) {
    throw new Error(`Unsupported GUM configuration bundle version: ${data.version}.`);
  }
  const id = requiredText(data.id, "Configuration bundle id");
  const kind = requiredText(data.kind, "Configuration bundle kind");
  if (!KIND_SET.has(kind)) throw new Error(`Unsupported GUM configuration bundle kind: ${kind}.`);
  if (!isObject(data.configuration)) throw new Error("A GUM configuration bundle must contain a configuration object.");
  if (data.documents !== undefined && !isObject(data.documents)) {
    throw new Error("Configuration bundle documents must be an object.");
  }
  return {
    format: GUM_CONFIGURATION_BUNDLE_FORMAT,
    version: GUM_CONFIGURATION_BUNDLE_VERSION,
    id,
    kind,
    name: String(data.name ?? "").trim(),
    configuration: clone(data.configuration),
    documents: validateDocuments(data.documents || {}, kind)
  };
}

function referenceKey(value, field, location) {
  if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, field)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1) throw new Error(`${field} at ${location} must be the only field in its reference object.`);
  return requiredText(value[field], `${field} at ${location}`);
}

function resolveTarget(parsed, uuidByKey, key, expectedTypes, location) {
  const target = parsed.documents[key];
  if (!target) throw new Error(`Unknown configuration bundle reference "${key}" at ${location}.`);
  if (!expectedTypes.has(target.type)) {
    throw new Error(`Configuration bundle reference "${key}" at ${location} targets unsupported type "${target.type}".`);
  }
  return uuidByKey.get(key);
}

function resolveGMScreenConfiguration(parsed, uuidByKey) {
  const configuration = clone(parsed.configuration);
  const tabs = Array.isArray(configuration.tabs) ? configuration.tabs : [];
  const groupCollections = [
    ...tabs.map(tab => tab?.groups),
    configuration.groups,
    ...(Array.isArray(configuration.columns) ? configuration.columns.map(column => column?.groups) : [])
  ].filter(Array.isArray);

  for (const groups of groupCollections) {
    for (const [groupIndex, group] of groups.entries()) {
      if (!Array.isArray(group?.items)) continue;
      group.items = group.items.map((entry, itemIndex) => {
        if (typeof entry === "string") return entry;
        const location = `configuration group ${groupIndex} item ${itemIndex}`;
        const key = referenceKey(entry, "itemRef", location);
        if (!key) throw new Error(`Invalid GM Screen item reference at ${location}.`);
        return resolveTarget(parsed, uuidByKey, key, ALLOWED_TYPES["gm-screen"], location);
      });
    }
  }
  return configuration;
}

function resolveStatusEffectList(parsed, uuidByKey, row, location) {
  const entries = [
    ...(Array.isArray(row.effectUuids) ? row.effectUuids : []),
    ...(Array.isArray(row.effectRefs) ? row.effectRefs.map(effectRef => ({ effectRef })) : [])
  ];
  row.effectUuids = [...new Set(entries.map((entry, index) => {
    if (typeof entry === "string") return entry;
    const itemLocation = `${location}.effectUuids.${index}`;
    const key = referenceKey(entry, "effectRef", itemLocation);
    if (!key) throw new Error(`Invalid world status effect reference at ${itemLocation}.`);
    return resolveTarget(parsed, uuidByKey, key, ALLOWED_TYPES["world-statuses"], itemLocation);
  }))];
  delete row.effectRefs;
}

function resolveWorldStatusConfiguration(parsed, uuidByKey) {
  const configuration = clone(parsed.configuration);
  for (const [statusId, override] of Object.entries(configuration.overrides || {})) {
    if (isObject(override)) resolveStatusEffectList(parsed, uuidByKey, override, `configuration.overrides.${statusId}`);
  }
  for (const [index, status] of (configuration.customStatuses || []).entries()) {
    if (isObject(status)) resolveStatusEffectList(parsed, uuidByKey, status, `configuration.customStatuses.${index}`);
  }
  return configuration;
}

function findUnresolvedReference(value, path = []) {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = findUnresolvedReference(entry, [...path, String(index)]);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(value)) return null;
  for (const [key, entry] of Object.entries(value)) {
    if (["itemRef", "effectRef", "effectRefs"].includes(key)) return [...path, key].join(".");
    const found = findUnresolvedReference(entry, [...path, key]);
    if (found) return found;
  }
  return null;
}

/** Allocate destination UUIDs and resolve references without mutating the source bundle. */
export function prepareConfigurationBundle(bundleData, packCollection = "") {
  const parsed = parseConfigurationBundle(bundleData) || bundleData;
  if (!parsed?.id || !parsed?.kind || !parsed?.configuration || !parsed?.documents) {
    throw new Error("Invalid GUM configuration bundle.");
  }

  const documentKeys = Object.keys(parsed.documents);
  let itemBundle = null;
  let preparedItems = null;
  let uuidByKey = new Map();
  if (documentKeys.length) {
    requiredText(packCollection, "Destination pack collection");
    itemBundle = {
      format: GUM_ITEM_BUNDLE_FORMAT,
      version: GUM_ITEM_BUNDLE_VERSION,
      id: parsed.id,
      name: parsed.name || parsed.id,
      root: documentKeys[0],
      documents: clone(parsed.documents)
    };
    preparedItems = prepareItemBundle(itemBundle, packCollection);
    uuidByKey = preparedItems.uuidByKey;
  }

  const configuration = parsed.kind === "gm-screen"
    ? resolveGMScreenConfiguration(parsed, uuidByKey)
    : resolveWorldStatusConfiguration(parsed, uuidByKey);
  const unresolved = findUnresolvedReference(configuration);
  if (unresolved) throw new Error(`Configuration bundle reference is not allowed at ${unresolved}.`);

  return { parsed, configuration, itemBundle, preparedItems };
}

function groupsFromGMScreen(configuration) {
  if (Array.isArray(configuration?.tabs)) return configuration.tabs.flatMap(tab => tab?.groups || []);
  if (Array.isArray(configuration?.groups)) return configuration.groups;
  if (Array.isArray(configuration?.columns)) return configuration.columns.flatMap(column => column?.groups || []);
  return [];
}

function referencedUuids(configuration, kind) {
  if (kind === "gm-screen") {
    return [...new Set(groupsFromGMScreen(configuration).flatMap(group => group?.items || []).filter(value => typeof value === "string" && value))];
  }
  return [...new Set([
    ...Object.values(configuration?.overrides || {}).flatMap(row => row?.effectUuids || []),
    ...(configuration?.customStatuses || []).flatMap(row => row?.effectUuids || [])
  ].filter(value => typeof value === "string" && value))];
}

function portableDocumentData(document) {
  const data = typeof document?.toObject === "function" ? document.toObject() : clone(document);
  delete data._id;
  delete data.folder;
  delete data._stats;
  return data;
}

function collectionValues(value) {
  return Array.isArray(value) ? value : Object.values(value || {});
}

function effectLinks(document) {
  const system = document?.system || {};
  return [
    ...collectionValues(system.activationEffects?.success),
    ...collectionValues(system.activationEffects?.failure),
    ...collectionValues(system.onDamageEffects),
    ...collectionValues(system.passiveEffects),
    ...collectionValues(system.useEventEffects),
    ...collectionValues(system.stateEffectGroups).flatMap(group => collectionValues(group?.effects)),
    ...collectionValues(system.melee_attacks).flatMap(attack => collectionValues(attack?.onDamageEffects)),
    ...collectionValues(system.ranged_attacks).flatMap(attack => collectionValues(attack?.onDamageEffects))
  ].filter(isObject);
}

/** Build an exportable bundle by embedding every resolvable referenced Item once. */
export async function buildConfigurationBundle({ id, name = "", kind, configuration, resolveUuid }) {
  if (!KIND_SET.has(kind)) throw new Error(`Unsupported GUM configuration bundle kind: ${kind}.`);
  if (typeof resolveUuid !== "function") throw new Error("A UUID resolver is required.");
  const sourceConfiguration = clone(configuration || {});
  const documents = {};
  const keyByUuid = new Map();
  const usedKeys = new Set();
  const queuedUuids = referencedUuids(sourceConfiguration, kind);
  const resolvedByUuid = new Map();

  for (let index = 0; index < queuedUuids.length; index += 1) {
    const uuid = queuedUuids[index];
    if (resolvedByUuid.has(uuid)) continue;
    const document = await resolveUuid(uuid);
    resolvedByUuid.set(uuid, document || null);
    if (!document || !ALLOWED_TYPES[kind].has(document.type)) continue;
    const base = `${document.type}-${document.id || "item"}`;
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${base}-${suffix++}`;
    usedKeys.add(key);
    keyByUuid.set(uuid, key);
    const data = portableDocumentData(document);
    documents[key] = data;
    if (kind === "gm-screen" && data.type === "gm_modifier") {
      for (const link of effectLinks(data)) {
        const effectUuid = String(link.effectUuid || "").trim();
        if (effectUuid && !resolvedByUuid.has(effectUuid)) queuedUuids.push(effectUuid);
      }
    }
  }

  if (kind === "gm-screen") {
    for (const document of Object.values(documents)) {
      if (document.type !== "gm_modifier") continue;
      for (const link of effectLinks(document)) {
        const effectUuid = String(link.effectUuid || "").trim();
        const effectKey = keyByUuid.get(effectUuid);
        if (!effectKey) continue;
        delete link.effectUuid;
        link.effectRef = effectKey;
      }
    }
  }

  if (kind === "gm-screen") {
    for (const group of groupsFromGMScreen(sourceConfiguration)) {
      if (!Array.isArray(group?.items)) continue;
      group.items = group.items.map(uuid => keyByUuid.has(uuid) ? { itemRef: keyByUuid.get(uuid) } : uuid);
    }
  } else {
    const rows = [
      ...Object.values(sourceConfiguration.overrides || {}),
      ...(sourceConfiguration.customStatuses || [])
    ];
    for (const row of rows) {
      if (!isObject(row) || !Array.isArray(row.effectUuids)) continue;
      row.effectUuids = row.effectUuids.map(uuid => keyByUuid.has(uuid) ? { effectRef: keyByUuid.get(uuid) } : uuid);
    }
  }

  return {
    format: GUM_CONFIGURATION_BUNDLE_FORMAT,
    version: GUM_CONFIGURATION_BUNDLE_VERSION,
    id: requiredText(id, "Configuration bundle id"),
    name: String(name || "").trim(),
    kind,
    configuration: sourceConfiguration,
    documents
  };
}
