import {
  equipmentIntegrityCurrentUpdate,
  equipmentIntegrityRecord,
  equipmentLinkedReserve,
  equipmentReserveBalanceUpdate,
  resolveEquipment
} from "./equipment-resolution.mjs";

export const MAGIC_CONSUMPTION_TRIGGERS = Object.freeze(["attempt", "success", "failure"]);
export const MAGIC_CONSUMPTION_SOURCE_TYPES = Object.freeze([
  "hp", "fp", "spell_reserve", "power_reserve", "combat_tracker", "item_quantity"
]);

const text = value => String(value ?? "").trim();
const normalizedName = value => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const entries = value => Array.isArray(value) ? value.map((entry, index) => [entry?.id || String(index), entry]) : Object.entries(value || {});

export function normalizeMagicConsumptionGroups(value = {}) {
  return entries(value).map(([key, raw = {}]) => {
    const id = text(raw.id || key);
    return {
      id,
      name: text(raw.name),
      trigger: MAGIC_CONSUMPTION_TRIGGERS.includes(raw.trigger) ? raw.trigger : "attempt",
      amount: text(raw.amount || "1") || "1",
      variableAmount: raw.variableAmount === true,
      confirm: raw.confirm !== false,
      sources: entries(raw.sources).map(([sourceKey, source = {}]) => ({
        id: text(source.id || sourceKey),
        type: MAGIC_CONSUMPTION_SOURCE_TYPES.includes(source.type) ? source.type : "fp",
        name: text(source.name),
        sourceKey: text(source.sourceKey)
      })).filter(source => source.id)
    };
  }).filter(group => group.id);
}

function itemArray(actor) {
  return Array.from(actor?.items || []);
}

function sourceRecord(data) {
  return { allowNegative: false, wholeOnly: false, ...data };
}

export function collectMagicConsumptionSources(actor) {
  if (!actor) return [];
  const sources = [];
  const system = actor.system || {};
  const add = source => sources.push(sourceRecord(source));

  add({ key: "hp", type: "hp", name: "PV", current: Number(system.attributes?.hp?.value) || 0, allowNegative: true, actorPaths: ["system.attributes.hp.value"] });
  add({ key: "fp", type: "fp", name: "PF", current: Number(system.attributes?.fp?.value) || 0, allowNegative: true, actorPaths: ["system.attributes.fp.value"] });

  for (const type of ["spell", "power"]) {
    for (const [id, reserve] of Object.entries(system[`${type}_reserves`] || {})) {
      const current = Number(reserve?.current ?? reserve?.value ?? 0) || 0;
      add({
        key: `${type}_reserve:${id}`,
        type: `${type}_reserve`,
        id,
        name: text(reserve?.name) || id,
        current,
        actorPaths: [`system.${type}_reserves.${id}.current`, `system.${type}_reserves.${id}.value`]
      });
    }
  }

  for (const [id, meter] of Object.entries(system.combat?.combat_meters || {})) {
    const current = Number(meter?.current ?? meter?.value ?? 0) || 0;
    add({
      key: `combat_tracker:${id}`,
      type: "combat_tracker",
      id,
      name: text(meter?.name) || id,
      current,
      actorPaths: [`system.combat.combat_meters.${id}.current`, `system.combat.combat_meters.${id}.value`]
    });
  }

  const actorItems = itemArray(actor);
  for (const item of actorItems.filter(item => (item?._source?.system || item?.system || {}).quantity !== undefined)) {
    const itemSystem = item._source?.system || item.system || {};
    add({
      key: `item_quantity:${item.id}`,
      type: "item_quantity",
      id: item.id,
      name: text(item.name) || item.id,
      current: Math.max(0, Number(itemSystem.quantity) || 0),
      wholeOnly: true,
      itemId: item.id,
      itemPath: "system.quantity",
      itemUpdateKind: "quantity"
    });
  }

  for (const item of actorItems.filter(item => item?.type === "equipment")) {
    const itemSystem = item._source?.system || item.system || {};
    // Resolve from persisted source data so a previous deduction in the same
    // activation cannot reuse a stale prepared reserve balance.
    const resolution = resolveEquipment(itemSystem);
    const reserve = equipmentLinkedReserve(item, resolution);
    if (reserve) {
      const type = reserve.type === "spell" ? "spell_reserve" : reserve.type === "power" ? "power_reserve" : "combat_tracker";
      add({
        key: `equipment_reserve:${item.id}:${type}`,
        type,
        id: item.id,
        name: text(reserve.name) || text(item.name) || item.id,
        current: Number(reserve.current) || 0,
        wholeOnly: true,
        itemId: item.id,
        itemUpdateKind: "equipment_reserve",
        equipmentResolution: resolution
      });
    }

    const integrity = equipmentIntegrityRecord(item, resolution);
    if (integrity) {
      add({
        key: `equipment_integrity:${item.id}`,
        type: "combat_tracker",
        id: item.id,
        name: text(integrity.name) || text(item.name) || item.id,
        current: Number(integrity.current) || 0,
        wholeOnly: true,
        itemId: item.id,
        itemUpdateKind: "equipment_integrity",
        equipmentResolution: resolution
      });
    }
  }

  return sources;
}

export function resolveMagicConsumptionOptions(group, sources) {
  const resolved = [];
  const seen = new Set();
  for (const configured of group?.sources || []) {
    const namedMatches = () => sources.filter(source => source.type === configured.type && (["hp", "fp"].includes(configured.type)
      || normalizedName(source.name) === normalizedName(configured.name)));
    const keyedMatches = configured.sourceKey
      ? sources.filter(source => source.key === configured.sourceKey && source.type === configured.type)
      : [];
    // A stored key identifies the exact embedded resource. If that key became
    // stale after an actor/item transfer, retain the portable name fallback.
    const matches = keyedMatches.length ? keyedMatches : namedMatches();
    for (const source of matches) {
      if (seen.has(source.key)) continue;
      seen.add(source.key);
      resolved.push(source);
    }
  }
  return resolved;
}

export function parseMagicConsumptionAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function validateMagicConsumptionChoices(groups, sources, choices = {}) {
  const errors = [];
  const normalizedChoices = {};
  for (const group of groups) {
    const options = resolveMagicConsumptionOptions(group, sources);
    const choice = choices[group.id] || {};
    const source = options.find(option => option.key === choice.sourceKey);
    const amount = parseMagicConsumptionAmount(choice.amount ?? group.amount);
    if (!options.length) errors.push({ code: "missing_sources", groupId: group.id });
    else if (!source) errors.push({ code: "invalid_source", groupId: group.id });
    if (amount === null) errors.push({ code: "invalid_amount", groupId: group.id });
    else if (source?.wholeOnly && !Number.isSafeInteger(amount)) errors.push({ code: "whole_amount_required", groupId: group.id, sourceKey: source.key });
    if (source && amount !== null) normalizedChoices[group.id] = { sourceKey: source.key, amount };
  }

  for (const outcome of ["success", "failure"]) {
    const totals = new Map();
    for (const group of groups.filter(entry => entry.trigger === "attempt" || entry.trigger === outcome)) {
      const choice = normalizedChoices[group.id];
      if (!choice) continue;
      totals.set(choice.sourceKey, (totals.get(choice.sourceKey) || 0) + choice.amount);
    }
    for (const [sourceKey, amount] of totals) {
      const source = sources.find(entry => entry.key === sourceKey);
      if (source && !source.allowNegative && amount > source.current) {
        errors.push({ code: "insufficient", outcome, sourceKey, required: amount, available: source.current });
      }
    }
  }

  return { valid: errors.length === 0, errors, choices: normalizedChoices };
}

export function buildMagicConsumptionDeductions(groups, choices, trigger) {
  const totals = new Map();
  for (const group of groups.filter(entry => entry.trigger === trigger)) {
    const choice = choices[group.id];
    if (!choice) continue;
    totals.set(choice.sourceKey, (totals.get(choice.sourceKey) || 0) + Number(choice.amount || 0));
  }
  return Array.from(totals, ([sourceKey, amount]) => ({ sourceKey, amount }));
}

export async function applyMagicConsumptionDeductions(actor, deductions = []) {
  if (!deductions.length) return { consumed: [], actorUpdates: {}, itemUpdates: [] };
  const sources = collectMagicConsumptionSources(actor);
  const actorUpdates = {};
  const itemUpdates = new Map();
  const consumed = [];

  for (const deduction of deductions) {
    const source = sources.find(entry => entry.key === deduction.sourceKey);
    const amount = parseMagicConsumptionAmount(deduction.amount);
    if (!source || amount === null) throw new Error("invalid_source");
    if (source.wholeOnly && !Number.isSafeInteger(amount)) throw new Error("whole_amount_required");
    if (!source.allowNegative && amount > source.current) throw new Error("insufficient");
    const next = source.current - amount;
    if (source.actorPaths) for (const path of source.actorPaths) actorUpdates[path] = next;
    if (source.itemId) {
      const item = itemArray(actor).find(entry => entry.id === source.itemId);
      if (!item) throw new Error("invalid_source");
      const update = itemUpdates.get(item.id) || { _id: item.id };
      if (source.itemUpdateKind === "equipment_reserve") {
        Object.assign(update, equipmentReserveBalanceUpdate(item, next, source.equipmentResolution));
      } else if (source.itemUpdateKind === "equipment_integrity") {
        Object.assign(update, equipmentIntegrityCurrentUpdate(item, next, source.equipmentResolution));
      } else {
        update[source.itemPath] = next;
      }
      itemUpdates.set(item.id, update);
    }
    consumed.push({ ...deduction, name: source.name, type: source.type, before: source.current, after: next });
  }

  if (Object.keys(actorUpdates).length) await actor.update(actorUpdates);
  const itemUpdateList = Array.from(itemUpdates.values());
  if (itemUpdateList.length) await actor.updateEmbeddedDocuments("Item", itemUpdateList);
  return { consumed, actorUpdates, itemUpdates: itemUpdateList };
}
