export const GUM_ITEM_BUNDLE_FORMAT = "gum-item-bundle";
export const GUM_ITEM_BUNDLE_VERSION = 1;
export const GUM_ITEM_BUNDLE_ITEM_TYPES = Object.freeze([
  "advantage", "disadvantage", "skill", "equipment", "money_source", "spell", "power",
  "modifier", "condition", "effect", "trigger", "eqp_modifier", "gm_modifier", "template"
]);

const ITEM_TYPE_SET = new Set(GUM_ITEM_BUNDLE_ITEM_TYPES);
const REFERENCE_KEYS = Object.freeze(["effectRef", "conditionRef", "modifierRef", "traitModifierRef"]);
const TRAIT_MODIFIER_ITEM_TYPES = new Set(["advantage", "disadvantage", "power"]);

const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const clone = value => typeof structuredClone === "function"
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function validateBundleDocument(document, key) {
  const type = requiredText(document.type, `Bundle document "${key}" type`);
  if (!ITEM_TYPE_SET.has(type)) {
    throw new Error(`Bundle document "${key}" has unsupported Item type "${type}".`);
  }
}

/** Return a normalized bundle, or null when the value uses another JSON format. */
export function parseItemBundle(data) {
  if (!data || data.format !== GUM_ITEM_BUNDLE_FORMAT) return null;
  if (data.version !== GUM_ITEM_BUNDLE_VERSION) {
    throw new Error(`Unsupported GUM item bundle version: ${data.version}.`);
  }

  const id = requiredText(data.id, "Bundle id");
  const root = requiredText(data.root, "Bundle root");
  const name = String(data.name ?? "").trim();
  if (!isObject(data.documents) || !Object.keys(data.documents).length) {
    throw new Error("A GUM item bundle must contain a non-empty documents object.");
  }
  if (!Object.prototype.hasOwnProperty.call(data.documents, root)) {
    throw new Error(`Bundle root "${root}" does not exist in documents.`);
  }

  const documents = {};
  for (const [rawKey, rawDocument] of Object.entries(data.documents)) {
    const key = requiredText(rawKey, "Document key");
    if (!isObject(rawDocument)) throw new Error(`Bundle document "${key}" must be an object.`);
    requiredText(rawDocument.name, `Bundle document "${key}" name`);
    validateBundleDocument(rawDocument, key);
    if (!isObject(rawDocument.system)) throw new Error(`Bundle document "${key}" must contain a system object.`);
    documents[key] = clone(rawDocument);
  }

  return { id, name, root, documents, version: GUM_ITEM_BUNDLE_VERSION };
}

/** Produce a deterministic 16-character Foundry document ID from a bundle namespace and key. */
export function stableBundleDocumentId(bundleId, key) {
  const input = `${bundleId}:${key}`;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x85ebca6b) >>> 0;
  }
  let result = "";
  for (let index = 0; index < 16; index += 1) {
    a = Math.imul(a ^ (a >>> 13) ^ index, 0x5bd1e995) >>> 0;
    b = Math.imul(b ^ (b >>> 15) ^ a, 0x27d4eb2d) >>> 0;
    result += alphabet[((a ^ b) >>> 0) % alphabet.length];
  }
  return result;
}

function compendiumUuid(collection, id) {
  return `Compendium.${collection}.Item.${id}`;
}

function linkedEntryId(bundle, documentKey, path) {
  return stableBundleDocumentId(bundle.id, `${documentKey}:${path.join(".")}:link`);
}

function getReferenceTarget(bundle, key, expectedType, path) {
  const target = bundle.documents[key];
  if (!target) throw new Error(`Unknown bundle reference "${key}" at ${path.join(".") || "document root"}.`);
  if (expectedType && target.type !== expectedType) {
    throw new Error(`Bundle reference "${key}" at ${path.join(".")} must target ${expectedType}, not ${target.type}.`);
  }
  return target;
}

function pathEquals(path, ...parts) {
  return path.length === parts.length && parts.every((part, index) => part === "*" || path[index] === part);
}

function isEffectReferencePath(documentType, value, path) {
  if (pathEquals(path, "system", "activationEffects", "success", "*")) return true;
  if (pathEquals(path, "system", "activationEffects", "failure", "*")) return true;
  if (pathEquals(path, "system", "onDamageEffects", "*")) return true;
  if (pathEquals(path, "system", "passiveEffects", "*")) return true;
  if (pathEquals(path, "system", "useEventEffects", "*")) return true;
  if (pathEquals(path, "system", "stateEffectGroups", "*", "effects", "*")) return true;
  if (pathEquals(path, "system", "melee_attacks", "*", "onDamageEffects", "*")) return true;
  if (pathEquals(path, "system", "ranged_attacks", "*", "onDamageEffects", "*")) return true;
  return documentType === "eqp_modifier"
    && value.type === "granted_effect"
    && pathEquals(path, "system", "features_data", "*");
}

function isConditionReferencePath(path) {
  return pathEquals(path, "system", "generalConditions", "*")
    || pathEquals(path, "system", "melee_attacks", "*", "generalConditions", "*")
    || pathEquals(path, "system", "ranged_attacks", "*", "generalConditions", "*");
}

function validateReferenceLocation(value, context, path) {
  const references = REFERENCE_KEYS.filter(key => Object.prototype.hasOwnProperty.call(value, key));
  if (!references.length) return;
  const location = path.join(".") || "document root";
  if (references.length > 1) {
    throw new Error(`Bundle reference at ${location} must use exactly one reference field, not ${references.join(", ")}.`);
  }

  const [reference] = references;
  const documentType = context.documentType;
  const allowed = reference === "effectRef"
    ? isEffectReferencePath(documentType, value, path)
    : reference === "conditionRef"
      ? isConditionReferencePath(path)
      : reference === "modifierRef"
        ? documentType === "equipment" && pathEquals(path, "system", "eqp_modifiers", "*")
        : TRAIT_MODIFIER_ITEM_TYPES.has(documentType) && pathEquals(path, "system", "modifiers", "*");
  if (!allowed) {
    throw new Error(`${reference} is not allowed at ${location} in a bundle document of type "${documentType}".`);
  }
}

function modifierSnapshot(source, uuid, overrides, fallbackId) {
  const system = source.system || {};
  const snapshot = {
    id: overrides.id || fallbackId,
    name: overrides.name || source.name,
    img: overrides.img || source.img,
    cost_adjustment: system.cost_adjustment,
    cost_factor: system.cost_factor,
    weight_mod: system.weight_mod,
    enabled: overrides.enabled ?? (system.enabled !== false),
    level: overrides.level ?? (system.level ?? 1),
    adjustment_schema: system.adjustment_schema ?? 0,
    cost_adjustment_data: clone(system.cost_adjustment_data || {}),
    weight_adjustment_data: clone(system.weight_adjustment_data || {}),
    features_data: clone(system.features_data || {}),
    gcs_features_unmapped: clone(system.gcs_features_unmapped || []),
    tech_level: system.tech_level,
    group: system.group,
    ref: system.ref,
    source_uuid: uuid
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (key !== "modifierRef") snapshot[key] = clone(value);
  }
  return snapshot;
}

function traitModifierSnapshot(source, uuid, overrides) {
  const system = source.system || {};
  const snapshot = {
    name: overrides.name || source.name,
    cost: system.cost,
    level: system.level,
    affects: system.affects,
    use_level_from_trait: system.use_level_from_trait,
    cost_ignores_level: system.cost_ignores_level,
    disabled: system.disabled,
    ref: system.ref,
    applied_effect: system.applied_effect,
    source_id: uuid,
    description: system.description
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (key !== "traitModifierRef") snapshot[key] = clone(value);
  }
  return snapshot;
}

function resolveLocalReferences(value, context, path = []) {
  if (Array.isArray(value)) {
    return value.map((entry, index) => resolveLocalReferences(entry, context, [...path, String(index)]));
  }
  if (!isObject(value)) return value;

  validateReferenceLocation(value, context, path);

  if (Object.prototype.hasOwnProperty.call(value, "traitModifierRef")) {
    const key = requiredText(value.traitModifierRef, `traitModifierRef at ${path.join(".")}`);
    const target = getReferenceTarget(context.bundle, key, "modifier", path);
    return traitModifierSnapshot(target, context.uuidByKey.get(key), value);
  }

  if (Object.prototype.hasOwnProperty.call(value, "modifierRef")) {
    const key = requiredText(value.modifierRef, `modifierRef at ${path.join(".")}`);
    const target = getReferenceTarget(context.bundle, key, "eqp_modifier", path);
    const modifierStack = new Set(context.modifierStack || []);
    if (modifierStack.has(key)) {
      throw new Error(`Circular modifierRef "${key}" at ${path.join(".") || "document root"}.`);
    }
    modifierStack.add(key);
    const resolvedTarget = resolveLocalReferences(clone(target), {
      ...context,
      documentKey: key,
      documentType: target.type,
      modifierStack
    }, []);
    return modifierSnapshot(
      resolvedTarget,
      context.uuidByKey.get(key),
      value,
      value.id || linkedEntryId(context.bundle, context.documentKey, path)
    );
  }

  const resolved = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!["effectRef", "conditionRef"].includes(key)) {
      resolved[key] = resolveLocalReferences(entry, context, [...path, key]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, "effectRef")) {
    const key = requiredText(value.effectRef, `effectRef at ${path.join(".")}`);
    const target = getReferenceTarget(context.bundle, key, "effect", path);
    const uuid = context.uuidByKey.get(key);
    if (value.type === "granted_effect") {
      resolved.effect_uuid = uuid;
      resolved.effect_name ||= target.name;
      resolved.effect_img ||= target.img;
    } else {
      resolved.effectUuid = uuid;
      resolved.name ||= target.name;
      resolved.img ||= target.img;
    }
    resolved.id ||= linkedEntryId(context.bundle, context.documentKey, path);
  }

  if (Object.prototype.hasOwnProperty.call(value, "conditionRef")) {
    const key = requiredText(value.conditionRef, `conditionRef at ${path.join(".")}`);
    const target = getReferenceTarget(context.bundle, key, "condition", path);
    resolved.uuid = context.uuidByKey.get(key);
    resolved.id ||= linkedEntryId(context.bundle, context.documentKey, path);
    resolved.name ||= target.name;
    resolved.img ||= target.img;
  }

  return resolved;
}

/**
 * Allocate stable IDs, build destination UUIDs, and replace bundle-local references.
 * This function is pure and does not mutate the parsed bundle.
 */
export function prepareItemBundle(bundleData, packCollection) {
  const parsed = parseItemBundle(bundleData) || bundleData;
  if (!parsed?.documents || !parsed?.root || !parsed?.id) throw new Error("Invalid GUM item bundle.");
  const collection = requiredText(packCollection, "Destination pack collection");
  const idByKey = new Map();
  const keyById = new Map();

  for (const [key, document] of Object.entries(parsed.documents)) {
    if (!isObject(document)) throw new Error(`Bundle document "${key}" must be an object.`);
    requiredText(document.name, `Bundle document "${key}" name`);
    validateBundleDocument(document, key);
    if (!isObject(document.system)) throw new Error(`Bundle document "${key}" must contain a system object.`);
    const id = String(document._id || stableBundleDocumentId(parsed.id, key)).trim();
    if (!/^[A-Za-z0-9]{16}$/.test(id)) {
      throw new Error(`Bundle document "${key}" has an invalid _id; expected 16 letters or digits.`);
    }
    if (keyById.has(id)) {
      throw new Error(`Bundle documents "${keyById.get(id)}" and "${key}" resolve to duplicate ID "${id}".`);
    }
    idByKey.set(key, id);
    keyById.set(id, key);
  }

  const uuidByKey = new Map(Array.from(idByKey, ([key, id]) => [key, compendiumUuid(collection, id)]));
  const documents = Object.entries(parsed.documents).map(([key, source]) => {
    const document = resolveLocalReferences(clone(source), {
      bundle: parsed,
      documentKey: key,
      documentType: source.type,
      uuidByKey
    });
    document._id = idByKey.get(key);
    document.folder = null;
    document.flags ||= {};
    document.flags.gum ||= {};
    document.flags.gum.itemBundle = {
      id: parsed.id,
      key,
      version: parsed.version,
      root: key === parsed.root
    };
    return { key, uuid: uuidByKey.get(key), data: document, root: key === parsed.root };
  });

  return {
    id: parsed.id,
    name: parsed.name || parsed.documents[parsed.root].name,
    root: parsed.root,
    rootUuid: uuidByKey.get(parsed.root),
    documents: documents.sort((left, right) => Number(left.root) - Number(right.root)),
    idByKey,
    uuidByKey
  };
}

/** Guard deterministic bundle IDs from overwriting unrelated compendium documents. */
export function previewItemBundleSynchronization(existingDocuments, preparedBundle) {
  const existingById = new Map(Array.from(existingDocuments || [], document => [document.id || document._id, document]));
  const collisions = [];
  let creates = 0;
  let updates = 0;

  for (const entry of preparedBundle.documents) {
    const existing = existingById.get(entry.data._id);
    if (!existing) {
      creates += 1;
      continue;
    }
    const marker = existing.flags?.gum?.itemBundle ?? existing._source?.flags?.gum?.itemBundle;
    if (marker?.id === preparedBundle.id && marker?.key === entry.key) updates += 1;
    else collisions.push({ key: entry.key, id: entry.data._id, existingName: existing.name || "" });
  }

  return { creates, updates, collisions };
}
