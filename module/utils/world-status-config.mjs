export const WORLD_STATUS_SETTING = "worldStatusConfiguration";
export const WORLD_STATUS_SCHEMA_VERSION = 1;

const DEFAULT_ICON = "icons/svg/aura.svg";
const DEFAULT_BINDING = Object.freeze({ stackMode: "refresh", stackLimit: 1, removeOnStatusOff: true });

const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : [])
  .map(value => String(value ?? "").trim())
  .filter(Boolean))];

export function normalizeWorldStatusId(value, fallback = "") {
  const normalized = String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeBinding(entry = {}) {
  const stackMode = ["replace", "refresh", "stack"].includes(entry.stackMode) ? entry.stackMode : DEFAULT_BINDING.stackMode;
  return {
    effectUuids: uniqueStrings(entry.effectUuids),
    legacyRuleUuids: uniqueStrings(entry.legacyRuleUuids),
    stackMode,
    stackLimit: Math.max(1, Number(entry.stackLimit) || 1),
    removeOnStatusOff: entry.removeOnStatusOff !== false
  };
}

function normalizeStatusEntry(entry = {}, { custom = false } = {}) {
  const id = normalizeWorldStatusId(entry.id);
  if (!id) return null;
  return {
    id,
    name: String(entry.name ?? "").trim() || id,
    img: String(entry.img ?? entry.icon ?? "").trim() || DEFAULT_ICON,
    ...normalizeBinding(entry),
    custom
  };
}

export function normalizeWorldStatusConfiguration(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const overrides = {};
  for (const [rawId, rawOverride] of Object.entries(source.overrides || {})) {
    const id = normalizeWorldStatusId(rawId);
    if (!id || !rawOverride || typeof rawOverride !== "object" || Array.isArray(rawOverride)) continue;
    overrides[id] = {
      ...(rawOverride.name !== undefined ? { name: String(rawOverride.name).trim() } : {}),
      ...(rawOverride.img !== undefined || rawOverride.icon !== undefined
        ? { img: String(rawOverride.img ?? rawOverride.icon ?? "").trim() || DEFAULT_ICON }
        : {}),
      ...normalizeBinding(rawOverride)
    };
  }

  const customStatuses = [];
  const seenCustom = new Set();
  for (const rawEntry of Array.isArray(source.customStatuses) ? source.customStatuses : []) {
    const entry = normalizeStatusEntry(rawEntry, { custom: true });
    if (!entry || seenCustom.has(entry.id)) continue;
    seenCustom.add(entry.id);
    customStatuses.push(entry);
  }

  return {
    version: WORLD_STATUS_SCHEMA_VERSION,
    bindingsMigrated: source.bindingsMigrated === true,
    disabledStatusIds: uniqueStrings(source.disabledStatusIds).map(id => normalizeWorldStatusId(id)).filter(Boolean),
    overrides,
    customStatuses,
    order: uniqueStrings(source.order).map(id => normalizeWorldStatusId(id)).filter(Boolean)
  };
}

export function localizeBaseStatuses(baseStatuses, localize = value => value) {
  return Array.from(baseStatuses ?? [], status => ({
    id: normalizeWorldStatusId(status?.id),
    name: String(localize(status?.name ?? status?.label ?? status?.id ?? "")),
    img: String(status?.img ?? status?.icon ?? DEFAULT_ICON)
  })).filter(status => status.id);
}

export function resolveWorldStatusRows(baseStatuses, configuration, { includeDisabled = false } = {}) {
  const config = normalizeWorldStatusConfiguration(configuration);
  const disabled = new Set(config.disabledStatusIds);
  const rows = [];
  const ids = new Set();

  for (const base of baseStatuses ?? []) {
    const normalizedBase = normalizeStatusEntry(base);
    if (!normalizedBase || ids.has(normalizedBase.id)) continue;
    ids.add(normalizedBase.id);
    const override = config.overrides[normalizedBase.id] || {};
    const row = {
      ...normalizedBase,
      ...override,
      ...normalizeBinding({ ...normalizedBase, ...override }),
      nameCustomized: override.name !== undefined,
      custom: false,
      enabled: !disabled.has(normalizedBase.id)
    };
    if (includeDisabled || row.enabled) rows.push(row);
  }

  for (const custom of config.customStatuses) {
    if (ids.has(custom.id)) continue;
    ids.add(custom.id);
    if (includeDisabled || !disabled.has(custom.id)) rows.push({ ...custom, nameCustomized: true, enabled: !disabled.has(custom.id) });
  }

  const orderIndex = new Map(config.order.map((id, index) => [id, index]));
  rows.sort((left, right) => {
    const leftIndex = orderIndex.has(left.id) ? orderIndex.get(left.id) : Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.has(right.id) ? orderIndex.get(right.id) : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
  return rows;
}

export function buildWorldStatusConfiguration(baseStatuses, rows, { bindingsMigrated = true } = {}) {
  const normalizedRows = [];
  const seen = new Set();
  for (const rawRow of rows ?? []) {
    const row = normalizeStatusEntry(rawRow, { custom: rawRow?.custom === true });
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    normalizedRows.push(row);
  }

  const baseById = new Map((baseStatuses ?? []).map(base => {
    const normalized = normalizeStatusEntry(base);
    return [normalized?.id, normalized];
  }).filter(([id]) => id));
  const overrides = {};
  const customStatuses = [];

  for (const row of normalizedRows) {
    const base = baseById.get(row.id);
    if (!base) {
      customStatuses.push({ ...row, custom: true });
      continue;
    }
    const override = {};
    if (row.name !== base.name) override.name = row.name;
    if (row.img !== base.img) override.img = row.img;
    if (row.effectUuids.length) override.effectUuids = row.effectUuids;
    if (row.legacyRuleUuids.length) override.legacyRuleUuids = row.legacyRuleUuids;
    if (row.stackMode !== DEFAULT_BINDING.stackMode) override.stackMode = row.stackMode;
    if (row.stackLimit !== DEFAULT_BINDING.stackLimit) override.stackLimit = row.stackLimit;
    if (row.removeOnStatusOff !== DEFAULT_BINDING.removeOnStatusOff) override.removeOnStatusOff = row.removeOnStatusOff;
    if (Object.keys(override).length) overrides[row.id] = override;
  }

  return normalizeWorldStatusConfiguration({
    version: WORLD_STATUS_SCHEMA_VERSION,
    bindingsMigrated,
    disabledStatusIds: [...baseById.keys()].filter(id => !seen.has(id)),
    overrides,
    customStatuses,
    order: normalizedRows.map(row => row.id)
  });
}

export function buildWorldStatusBindingRules(statusRows) {
  return (statusRows ?? []).filter(status => status.effectUuids?.length || status.legacyRuleUuids?.length).map(status => ({
    id: `world-status-${status.id}`,
    uuid: `WorldStatus.${status.id}`,
    name: status.name,
    legacyRuleUuids: uniqueStrings(status.legacyRuleUuids),
    system: {
      bindingMode: "status-link",
      statusBinding: {
        enabled: true,
        statusId: status.id,
        stackMode: status.stackMode,
        stackLimit: status.stackLimit,
        removeOnStatusOff: status.removeOnStatusOff
      },
      effects: status.effectUuids.map(uuid => ({ uuid }))
    }
  }));
}

export function applyWorldStatusConfiguration(baseStatuses, configuration, {
  target = globalThis.CONFIG,
  localize = value => globalThis.game?.i18n?.localize?.(value) ?? value
} = {}) {
  const localizedBase = localizeBaseStatuses(baseStatuses, localize);
  const rows = resolveWorldStatusRows(localizedBase, configuration);
  if (target) target.statusEffects = rows.map((status, index) => ({
    id: status.id,
    name: status.name,
    label: status.name,
    img: status.img,
    icon: status.img,
    order: index
  }));
  return rows;
}

export function collectWorldStatusActors({ worldActors = [], scenes = [], canvasTokens = [] } = {}) {
  const actors = new Map();
  const add = actor => {
    if (!actor) return;
    const identity = actor.uuid || actor.id || actor;
    if (!actors.has(identity)) actors.set(identity, actor);
  };
  for (const actor of worldActors ?? []) add(actor);
  for (const scene of scenes ?? []) {
    for (const token of scene?.tokens ?? []) add(token?.actor);
  }
  for (const token of canvasTokens ?? []) add(token?.actor);
  return [...actors.values()];
}

export function buildWorldStatusPresentationPlan(actors, statusRows) {
  const statuses = new Map((statusRows ?? []).map(status => [normalizeWorldStatusId(status?.id), status]));
  const operations = [];
  for (const actor of actors ?? []) {
    const updates = [];
    for (const effect of actor?.effects ?? []) {
      const effectStatuses = Array.from(effect?.statuses ?? [], id => normalizeWorldStatusId(id)).filter(Boolean);
      if (effectStatuses.length !== 1) continue;
      const status = statuses.get(effectStatuses[0]);
      if (!status) continue;
      const hasMechanicalChanges = Array.isArray(effect?.changes) && effect.changes.length > 0;
      const isEffectAutomation = Boolean(effect?.flags?.gum?.effectUuid);
      if (hasMechanicalChanges || isEffectAutomation) continue;
      const update = { _id: effect.id || effect._id };
      if ((status.custom || status.nameCustomized) && effect.name !== status.name) update.name = status.name;
      if (effect.img !== status.img) update.img = status.img;
      if (Object.keys(update).length > 1) updates.push(update);
    }
    if (updates.length) operations.push({ actor, updates });
  }
  return operations;
}

export function activeEffectHasStatus(effect, statusId) {
  const normalizedId = normalizeWorldStatusId(statusId);
  if (!normalizedId) return false;
  const statuses = Array.from(effect?.statuses ?? [], value => String(value));
  const coreStatusId = effect?.flags?.core?.statusId;
  return statuses.includes(normalizedId) || coreStatusId === normalizedId;
}

export function itemReferencesStatus(item, statusId) {
  const normalizedId = normalizeWorldStatusId(statusId);
  const system = item?.system || {};
  if (!normalizedId) return false;
  if ([system.statusId, system.attachedStatusId].some(value => normalizeWorldStatusId(value) === normalizedId)) return true;
  return (Array.isArray(system.actions) ? system.actions : []).some(action =>
    [action?.statusId, action?.attachedStatusId].some(value => normalizeWorldStatusId(value) === normalizedId)
  );
}

export function getItemStatusReferences(item) {
  const references = [];
  const add = (value, path) => {
    const statusId = normalizeWorldStatusId(value);
    if (statusId) references.push({ statusId, path });
  };
  const system = item?.system || {};
  add(system.statusId, "system.statusId");
  add(system.attachedStatusId, "system.attachedStatusId");
  for (const [index, action] of (Array.isArray(system.actions) ? system.actions : []).entries()) {
    add(action?.statusId, `system.actions.${index}.statusId`);
    add(action?.attachedStatusId, `system.actions.${index}.attachedStatusId`);
  }
  return references;
}

export function collectInvalidWorldStatusReferences(validStatusIds, { actors = [], items = [], bindingRules = [] } = {}) {
  const valid = new Set(Array.from(validStatusIds ?? [], id => normalizeWorldStatusId(id)).filter(Boolean));
  const invalid = statusId => statusId && !valid.has(statusId);
  const activeEffects = [];
  for (const actor of actors ?? []) {
    for (const effect of actor?.effects ?? []) {
      const statusIds = new Set(Array.from(effect?.statuses ?? [], id => normalizeWorldStatusId(id)).filter(invalid));
      const coreStatusId = normalizeWorldStatusId(effect?.flags?.core?.statusId);
      if (invalid(coreStatusId)) statusIds.add(coreStatusId);
      if (statusIds.size) activeEffects.push({ actor, effect, statusIds: [...statusIds] });
    }
  }

  const itemReferences = [];
  const seenItems = new Set();
  for (const item of items ?? []) {
    const references = getItemStatusReferences(item).filter(reference => invalid(reference.statusId));
    const identity = item?.uuid || `${item?.type || "Item"}.${item?.id || item?._id || ""}`;
    if (!references.length || (identity && seenItems.has(identity))) continue;
    if (identity) seenItems.add(identity);
    itemReferences.push({ item, references });
  }

  const legacyRules = [];
  const seenRules = new Set();
  for (const rule of bindingRules ?? []) {
    const statusId = normalizeWorldStatusId(rule?.system?.statusBinding?.statusId);
    const identity = rule?.uuid || rule?.id || rule?._id;
    if (!invalid(statusId) || (identity && seenRules.has(identity))) continue;
    if (identity) seenRules.add(identity);
    legacyRules.push({ rule, statusId });
  }
  return { activeEffects, itemReferences, legacyRules };
}

export function collectWorldStatusDependencies(statusId, { actors = [], items = [], bindingRules = [] } = {}) {
  const normalizedId = normalizeWorldStatusId(statusId);
  const activeEffects = [];
  for (const actor of actors ?? []) {
    for (const effect of actor?.effects ?? []) {
      if (activeEffectHasStatus(effect, normalizedId)) activeEffects.push({ actor, effect });
    }
  }

  const seenItems = new Set();
  const referencingItems = [];
  for (const item of items ?? []) {
    const identity = item?.uuid || `${item?.type || "Item"}.${item?.id || item?._id || ""}`;
    if (!identity || seenItems.has(identity) || !itemReferencesStatus(item, normalizedId)) continue;
    seenItems.add(identity);
    referencingItems.push(item);
  }

  const seenRules = new Set();
  const referencingRules = [];
  for (const rule of bindingRules ?? []) {
    if (normalizeWorldStatusId(rule?.system?.statusBinding?.statusId) !== normalizedId) continue;
    const identity = rule?.uuid || rule?.id || rule?._id;
    if (identity && seenRules.has(identity)) continue;
    if (identity) seenRules.add(identity);
    referencingRules.push(rule);
  }

  return { activeEffects, referencingItems, referencingRules };
}

export function buildWorldStatusCleanupPlan(actor, statusId) {
  const normalizedId = normalizeWorldStatusId(statusId);
  const updates = [];
  const deletes = [];
  for (const effect of actor?.effects ?? []) {
    if (!activeEffectHasStatus(effect, normalizedId)) continue;
    const remainingStatuses = Array.from(effect.statuses ?? [], value => String(value))
      .filter(value => normalizeWorldStatusId(value) !== normalizedId);
    const isStatusAutomation = effect?.flags?.gum?.source === "statusBinding"
      && normalizeWorldStatusId(effect?.flags?.gum?.statusBindingStatusId) === normalizedId;
    const hasMechanicalChanges = Array.isArray(effect?.changes) && effect.changes.length > 0;
    if (isStatusAutomation || (!remainingStatuses.length && !hasMechanicalChanges)) {
      deletes.push(effect.id || effect._id);
      continue;
    }
    const update = { _id: effect.id || effect._id, statuses: remainingStatuses };
    if (normalizeWorldStatusId(effect?.flags?.core?.statusId) === normalizedId) update["flags.core.-=statusId"] = null;
    updates.push(update);
  }
  return { updates, deletes };
}
