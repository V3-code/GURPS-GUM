export const PASSIVE_CONDITION_CONFIG_SETTING = "passiveConditionConfiguration";
export const PASSIVE_CONDITION_CONFIG_VERSION = 1;

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const idOf = value => String(value ?? "").trim();

export function normalizePassiveConditionConfiguration(value = {}) {
  const entries = Array.isArray(value?.entries) ? value.entries : [];
  const seen = new Set();
  const normalizedEntries = entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const sourceUuid = idOf(entry.sourceUuid ?? entry.uuid);
    const id = idOf(entry.id) || sourceUuid || `passive-${index + 1}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const snapshot = entry.snapshot && typeof entry.snapshot === "object" ? clone(entry.snapshot) : null;
    return [{ id, sourceUuid, name: String(entry.name || snapshot?.name || sourceUuid || `Condição ${index + 1}`), img: String(entry.img || snapshot?.img || "icons/svg/aura.svg"), enabled: entry.enabled !== false, snapshot }];
  });
  return {
    version: PASSIVE_CONDITION_CONFIG_VERSION,
    initialized: value?.initialized === true,
    entries: normalizedEntries,
    managedSourceUuids: [...new Set([...(Array.isArray(value?.managedSourceUuids) ? value.managedSourceUuids : []), ...normalizedEntries.map(entry => entry.sourceUuid)].map(idOf).filter(Boolean))]
  };
}

export function portablePassiveConditionSnapshot(document) {
  const data = clone(document?.toObject?.() ?? document ?? {});
  delete data._id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  delete data._stats;
  if (data.flags && Object.hasOwn(data.flags, "exportSource")) delete data.flags.exportSource;
  if (data.flags && Object.keys(data.flags).length === 0) delete data.flags;
  return data;
}

export function buildPassiveConditionConfigEntry(document, { id = null } = {}) {
  const sourceUuid = idOf(document?.uuid ?? document?._stats?.compendiumSource);
  const snapshot = portablePassiveConditionSnapshot(document);
  return { id: idOf(id) || sourceUuid || globalThis.foundry?.utils?.randomID?.() || `passive-${Date.now()}`, sourceUuid, name: String(document?.name || snapshot.name || "Condição"), img: String(document?.img || snapshot.img || "icons/svg/aura.svg"), enabled: true, snapshot };
}

export function getPassiveConditionSourceUuid(item) {
  return item?.flags?.gum?.passiveConditionSourceUuid || item?._stats?.compendiumSource || item?._source?._stats?.compendiumSource || null;
}

export function isManagedPassiveCondition(item) {
  return item?.flags?.gum?.passiveConditionManaged === true;
}

export function preparePassiveConditionCreateData(sourceRule, { configId = null, sourceUuid = null } = {}) {
  const data = portablePassiveConditionSnapshot(sourceRule);
  const resolvedSourceUuid = idOf(sourceUuid) || idOf(sourceRule?.uuid);
  data.flags = { ...(data.flags || {}), gum: { ...(data.flags?.gum || {}), passiveConditionManaged: true, passiveConditionConfigId: idOf(configId) || resolvedSourceUuid, passiveConditionSourceUuid: resolvedSourceUuid } };
  data._stats = { ...(data._stats || {}), compendiumSource: resolvedSourceUuid || null };
  return data;
}

const sourceRecord = source => ({ document: source?.document ?? source, configId: idOf(source?.configId ?? source?.id), sourceUuid: idOf(source?.sourceUuid ?? source?.document?.uuid ?? source?.uuid) });

export function buildPassiveConditionSyncOperations(actorItems, sourceRules, { removeMissing = false, managedSourceUuids = [] } = {}) {
  const items = Array.from(actorItems ?? []);
  const existingByConfigId = new Map();
  const existingBySource = new Map();
  for (const item of items) {
    const configId = idOf(item?.flags?.gum?.passiveConditionConfigId);
    const sourceUuid = idOf(getPassiveConditionSourceUuid(item));
    if (configId && !existingByConfigId.has(configId)) existingByConfigId.set(configId, item);
    if (sourceUuid && !existingBySource.has(sourceUuid)) existingBySource.set(sourceUuid, item);
  }

  const updates = [];
  const creates = [];
  const retainedIds = new Set();
  for (const rawSource of sourceRules ?? []) {
    const { document, configId, sourceUuid } = sourceRecord(rawSource);
    if (!document || document.system?.bindingMode === "status-link") continue;
    const effectiveConfigId = configId || sourceUuid;
    const existing = existingByConfigId.get(effectiveConfigId) || existingBySource.get(sourceUuid);
    const prepared = preparePassiveConditionCreateData(document, { configId: effectiveConfigId, sourceUuid });
    if (!existing) {
      creates.push(prepared);
      continue;
    }
    retainedIds.add(existing.id);
    updates.push({
      _id: existing.id,
      name: prepared.name,
      system: prepared.system,
      img: prepared.img,
      "flags.gum.passiveConditionManaged": true,
      "flags.gum.passiveConditionConfigId": effectiveConfigId,
      "flags.gum.passiveConditionSourceUuid": sourceUuid
    });
  }

  const legacySources = new Set(Array.from(managedSourceUuids ?? [], idOf).filter(Boolean));
  const deletes = removeMissing ? items.filter(item => item?.type === "condition" && (isManagedPassiveCondition(item) || legacySources.has(idOf(getPassiveConditionSourceUuid(item)))) && !retainedIds.has(item.id)).map(item => item.id) : [];
  return { updates, creates, deletes };
}

export function summarizePassiveConditionSync(actors, sourceRules, options = {}) {
  return Array.from(actors ?? []).reduce((summary, actor) => {
    const plan = buildPassiveConditionSyncOperations(actor?.items, sourceRules, options);
    summary.actors += 1;
    summary.creates += plan.creates.length;
    summary.updates += plan.updates.length;
    summary.deletes += plan.deletes.length;
    return summary;
  }, { actors: 0, creates: 0, updates: 0, deletes: 0 });
}

export async function resolvePassiveConditionConfiguration(configuration, { resolveUuid = globalThis.fromUuid } = {}) {
  const normalized = normalizePassiveConditionConfiguration(configuration);
  const resolved = [];
  const missing = [];
  for (const entry of normalized.entries.filter(candidate => candidate.enabled)) {
    let document = entry.sourceUuid && resolveUuid ? await resolveUuid(entry.sourceUuid).catch(() => null) : null;
    if (!document && entry.snapshot) document = { ...clone(entry.snapshot), uuid: entry.sourceUuid, toObject: () => clone(entry.snapshot) };
    if (!document) {
      missing.push(entry);
      continue;
    }
    resolved.push({ document, configId: entry.id, sourceUuid: entry.sourceUuid });
  }
  return { configuration: normalized, resolved, missing };
}
