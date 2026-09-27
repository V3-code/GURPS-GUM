const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export const EQUIPMENT_MODIFIER_SCHEMA_VERSION = 2;

export function parseEquipmentAdjustment(rawValue, { allowCF = false } = {}) {
  const source = String(rawValue ?? "").trim();
  if (!source) return { operation: "none", value: 0, label: "", valid: true };
  const normalized = source.replace(",", ".");
  const patterns = [
    [allowCF ? /^([+-]?\d+(?:\.\d+)?)\s*cf$/i : null, "cost_factor", value => `${value >= 0 ? "+" : ""}${value} CF`],
    [/^([+-]?\d+(?:\.\d+)?)\s*%$/, "percent", value => `${value >= 0 ? "+" : ""}${value}%`],
    [/^[x*]\s*(\d+(?:\.\d+)?)$/i, "multiply", value => `x${value}`],
    [/^([+-]?\d+(?:\.\d+)?)$/, "add", value => `${value >= 0 ? "+" : ""}${value}`]
  ];
  for (const [pattern, operation, format] of patterns) {
    const match = pattern?.exec(normalized);
    if (!match) continue;
    const value = Number(match[1]);
    return { operation, value, label: format(value), valid: true };
  }
  return { operation: "invalid", value: 0, label: source, valid: false };
}

export function normalizeLegacyEquipmentModifier(modifier = {}) {
  if (Array.isArray(modifier.actions) && modifier.actions.length) {
    const explicit = clone(modifier.actions);
    const legacy = normalizeLegacyEquipmentModifier({ ...modifier, actions: [] });
    return explicit.concat(legacy.filter(action => {
      if (action.type === "pricing") return !explicit.some(candidate => candidate.type === "pricing" && candidate.property === action.property);
      if (action.type === "equipment_property") return !explicit.some(candidate => candidate.type === "equipment_property" && candidate.property === action.property);
      return true;
    }));
  }
  const actions = [];
  const adjustmentSource = String(modifier.cost_adjustment ?? "").trim();
  const parsedAdjustment = parseEquipmentAdjustment(adjustmentSource, { allowCF: true });
  const legacyFactor = Number(modifier.cost_factor) || 0;
  const costSource = legacyFactor && (!adjustmentSource || (parsedAdjustment.operation === "cost_factor" && parsedAdjustment.value === 0))
    ? `${legacyFactor} CF`
    : adjustmentSource;
  const cost = parseEquipmentAdjustment(costSource, { allowCF: true });
  if (cost.valid && cost.operation !== "none" && cost.value !== 0) actions.push({
    id: "legacy-cost", type: "pricing", property: "cost", operation: cost.operation, value: cost.value,
    label: "Ajuste de custo", phase: pricingPhase(cost.operation)
  });
  const weight = parseEquipmentAdjustment(modifier.weight_mod);
  if (weight.valid && weight.operation !== "none" && !(weight.operation === "multiply" && weight.value === 1) && weight.value !== 0) actions.push({
    id: "legacy-weight", type: "pricing", property: "weight", operation: weight.operation, value: weight.value,
    label: "Ajuste de peso", phase: pricingPhase(weight.operation)
  });
  if (String(modifier.tech_level_mod ?? "").trim()) actions.push({
    id: "legacy-tech-level", type: "equipment_property", property: "tech_level", operation: "add",
    value: Number(modifier.tech_level_mod) || 0, label: "Ajuste de NT"
  });
  return actions;
}

function pricingPhase(operation) {
  return ({ cost_factor: 10, percent: 20, multiply: 30, add: 40, override: 50 })[operation] ?? 50;
}

const PROPERTY_REGISTRY = {
  tech_level: { path: "tech_level", kind: "number-text", operations: ["add", "override"] },
  tech_sm: { path: "tech_sm", kind: "number", operations: ["add", "multiply", "override"] },
  legality_class: { path: "legality_class", kind: "number-text", operations: ["add", "override"] },
  material: { path: "material", kind: "text", operations: ["override", "append", "prepend"] },
  quality: { path: "quality", kind: "text", operations: ["override", "append", "prepend"] },
  item_hp: { path: "item_hp", kind: "number", operations: ["add", "multiply", "override"] },
  item_ht: { path: "item_ht", kind: "number", operations: ["add", "multiply", "override"] },
  item_dr: { path: "item_dr", kind: "number", operations: ["add", "multiply", "override"] },
  holdout: { path: "holdout", kind: "number", operations: ["add", "multiply", "override"] },
  defense_bonus: { path: "defense_bonus", kind: "number", operations: ["add", "multiply", "override"] },
  equip_time: { path: "equip_time", kind: "number", operations: ["add", "multiply", "override"] }
};

const ATTACK_PROPERTY_REGISTRY = {
  mode: { path: "mode", kind: "text", operations: ["override", "append", "prepend"] },
  skill_name: { path: "skill_name", kind: "text", operations: ["override"] },
  skill_level_mod: { path: "skill_level_mod", kind: "number", operations: ["add", "multiply", "override"] },
  damage_formula: { path: "damage_formula", kind: "text", operations: ["override", "append"] },
  damage_type: { path: "damage_type", kind: "text", operations: ["override"] },
  damage_scaling: { path: "damage_scaling", kind: "text", operations: ["override"] },
  armor_divisor: { path: "armor_divisor", kind: "number", operations: ["add", "multiply", "override"] },
  reach: { path: "reach", kind: "text", operations: ["override", "append"] },
  parry: { path: "parry", kind: "number-text", operations: ["add", "override"] },
  block: { path: "block", kind: "number-text", operations: ["add", "override"] },
  min_strength: { path: "min_strength", kind: "number", operations: ["add", "multiply", "override"] },
  accuracy: { path: "accuracy", kind: "number-text", operations: ["add", "override"] },
  range: { path: "range", kind: "text", operations: ["override"] },
  rof: { path: "rof", kind: "text", operations: ["override"] },
  shots: { path: "shots", kind: "text", operations: ["override"] },
  rcl: { path: "rcl", kind: "number-text", operations: ["add", "override"] }
};

export const equipmentModifierProperties = PROPERTY_REGISTRY;
export const equipmentAttackModifierProperties = ATTACK_PROPERTY_REGISTRY;

export function registerEquipmentModifierProperty(id, config = {}, { attack = false } = {}) {
  if (!/^[a-z][a-z0-9_.-]*$/i.test(String(id || ""))) throw new Error("ID de propriedade de equipamento inválido.");
  if (!/^[a-z][a-z0-9_.-]*$/i.test(String(config.path || "")) || String(config.path).split(".").some(key => ["__proto__", "prototype", "constructor"].includes(key))) {
    throw new Error("Caminho de propriedade de equipamento inválido.");
  }
  const operations = Array.isArray(config.operations) ? config.operations.filter(operation => ["add", "multiply", "override", "append", "prepend"].includes(operation)) : [];
  if (!operations.length) throw new Error("A propriedade deve declarar ao menos uma operação suportada.");
  const registry = attack ? ATTACK_PROPERTY_REGISTRY : PROPERTY_REGISTRY;
  registry[id] = { path: config.path, kind: config.kind || "text", operations };
  return registry[id];
}

function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cursor = object;
  for (const key of keys) cursor = cursor[key] ??= {};
  cursor[last] = value;
}

function applyOperation(current, operation, operand, kind) {
  if (operation === "override") return kind === "number" ? Number(operand) : operand;
  if (operation === "append") return `${current ?? ""}${operand ?? ""}`;
  if (operation === "prepend") return `${operand ?? ""}${current ?? ""}`;
  const left = Number(current) || 0;
  const right = Number(operand) || 0;
  if (operation === "add") return left + right;
  if (operation === "multiply") return left * right;
  return current;
}

export function equipmentCapabilities(system = {}) {
  return {
    has_melee_attack: Object.keys(system.melee_attacks || {}).length > 0,
    has_ranged_attack: Object.keys(system.ranged_attacks || {}).length > 0,
    has_attack: Object.keys(system.melee_attacks || {}).length + Object.keys(system.ranged_attacks || {}).length > 0,
    has_defense_bonus: Number(system.defense_bonus) !== 0,
    has_dr: Number(system.item_dr) > 0 || Object.keys(system.dr_locations || {}).length > 0,
    is_container: system.is_container === true
  };
}

export function matchesEquipmentRequirements(system = {}, requirements = {}) {
  const caps = equipmentCapabilities(system);
  const test = key => Boolean(caps[key]);
  const all = Array.isArray(requirements.all) ? requirements.all : [];
  const any = Array.isArray(requirements.any) ? requirements.any : [];
  const none = Array.isArray(requirements.none) ? requirements.none : [];
  return all.every(test) && (!any.length || any.some(test)) && none.every(key => !test(key));
}

function selectedAttacks(system, selector = {}) {
  const mode = selector.mode || "all";
  const ids = new Set(Array.isArray(selector.ids) ? selector.ids.map(String) : String(selector.ids || "").split(",").map(v => v.trim()).filter(Boolean));
  const entries = [];
  if (["all", "melee", "ids"].includes(mode)) for (const [id, attack] of Object.entries(system.melee_attacks || {})) if (mode !== "ids" || ids.has(id)) entries.push({ id, attack, attackType: "melee" });
  if (["all", "ranged", "ids"].includes(mode)) for (const [id, attack] of Object.entries(system.ranged_attacks || {})) if (mode !== "ids" || ids.has(id)) entries.push({ id, attack, attackType: "ranged" });
  return entries;
}

function normalizeModifierEntries(modifiers) {
  return (Array.isArray(modifiers) ? modifiers : Object.entries(modifiers || {}).map(([id, value]) => ({ id, ...value })))
    .filter(modifier => modifier && modifier.enabled !== false)
    .map((modifier, modifierIndex) => ({ modifier, modifierIndex, actions: normalizeLegacyEquipmentModifier(modifier) }));
}

function mergeModifierEffectLinks(system, modifier, modifierIndex) {
  const prefix = `eqpm-${modifier.id || modifierIndex}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const collections = ["onDamageEffects", "passiveEffects", "useEventEffects", "generalConditions"];
  for (const collectionName of collections) {
    const links = modifier[collectionName];
    if (!links || typeof links !== "object") continue;
    const target = system[collectionName] ??= {};
    for (const [id, link] of Object.entries(links)) target[`${prefix}-${id}`] = clone(link);
  }
  for (const outcome of ["success", "failure"]) {
    const links = modifier.activationEffects?.[outcome];
    if (!links || typeof links !== "object") continue;
    const target = (system.activationEffects ??= { success: {}, failure: {} })[outcome] ??= {};
    for (const [id, link] of Object.entries(links)) target[`${prefix}-${id}`] = clone(link);
  }
}

export function prepareEquipment(baseSystem = {}, modifiers = baseSystem.eqp_modifiers || {}) {
  const system = clone(baseSystem) || {};
  const calculation = { cost: [], weight: [] };
  const appliedActions = [];
  const skippedActions = [];
  const warnings = [];
  const pricing = { cost: [], weight: [] };
  const entries = normalizeModifierEntries(modifiers);

  for (const { modifier, modifierIndex, actions } of entries) {
    if (!matchesEquipmentRequirements(baseSystem, modifier.requirements)) {
      warnings.push(`${modifier.name || "Modificador"}: requisitos não atendidos.`);
      continue;
    }
    mergeModifierEffectLinks(system, modifier, modifierIndex);
    actions.forEach((action, actionIndex) => {
      const record = { modifierId: modifier.id || "", modifierName: modifier.name || "Modificador", actionId: action.id || `${modifierIndex}-${actionIndex}`, label: action.label || action.type };
      if (action.enabled === false) return skippedActions.push({ ...record, reason: "disabled" });
      if (action.type === "pricing" && ["cost", "weight"].includes(action.property)) {
        pricing[action.property].push({ ...record, ...clone(action), phase: Number(action.phase ?? pricingPhase(action.operation)), modifierIndex, actionIndex });
        return;
      }
      if (action.type === "equipment_property") {
        const config = Object.hasOwn(PROPERTY_REGISTRY, action.property) ? PROPERTY_REGISTRY[action.property] : null;
        if (!config || !config.operations.includes(action.operation)) return skippedActions.push({ ...record, reason: "unsupported-property" });
        const before = getPath(system, config.path);
        const after = applyOperation(before, action.operation, action.value, config.kind);
        setPath(system, config.path, after);
        appliedActions.push({ ...record, target: "equipment", property: action.property, operation: action.operation, before, after });
        return;
      }
      if (action.type === "attack_property") {
        const config = Object.hasOwn(ATTACK_PROPERTY_REGISTRY, action.property) ? ATTACK_PROPERTY_REGISTRY[action.property] : null;
        const targets = selectedAttacks(system, action.selector);
        if (!config || !config.operations.includes(action.operation)) return skippedActions.push({ ...record, reason: "unsupported-property" });
        if (!targets.length) {
          warnings.push(`${record.modifierName}: ${record.label} não encontrou ataques compatíveis.`);
          return skippedActions.push({ ...record, reason: "no-target" });
        }
        for (const target of targets) {
          const before = getPath(target.attack, config.path);
          const after = applyOperation(before, action.operation, action.value, config.kind);
          setPath(target.attack, config.path, after);
          appliedActions.push({ ...record, target: `${target.attackType}:${target.id}`, property: action.property, operation: action.operation, before, after });
        }
        return;
      }
      if (action.type === "attack_create") {
        const attackType = action.attack_type === "ranged" ? "ranged" : "melee";
        const collection = system[`${attackType}_attacks`] ??= {};
        const stableId = `eqpm-${modifier.id || modifierIndex}-${action.id || actionIndex}`.replace(/[^a-zA-Z0-9_-]/g, "-");
        if (!collection[stableId]) collection[stableId] = { ...(clone(action.attack) || {}), id: stableId };
        appliedActions.push({ ...record, target: `${attackType}:${stableId}`, property: "attack", operation: "create", before: null, after: clone(collection[stableId]) });
        return;
      }
      skippedActions.push({ ...record, reason: "unsupported-action" });
    });
  }

  for (const property of ["cost", "weight"]) {
    const baseValue = Number(baseSystem[property]) || 0;
    let current = baseValue;
    const ordered = pricing[property].sort((a, b) => a.phase - b.phase || a.modifierIndex - b.modifierIndex || a.actionIndex - b.actionIndex || String(a.actionId).localeCompare(String(b.actionId)));
    const cfTotal = ordered.filter(action => action.operation === "cost_factor").reduce((sum, action) => sum + (Number(action.value) || 0), 0);
    let cfApplied = false;
    for (const action of ordered) {
      if (action.operation === "cost_factor") {
        if (cfApplied) continue;
        const before = current;
        current = current * Math.max(0, 1 + cfTotal);
        calculation[property].push({ ...action, operation: "cost_factor", value: cfTotal, basis: "base", before, after: current });
        cfApplied = true;
      } else {
        const before = current;
        if (action.operation === "percent") current *= 1 + (Number(action.value) || 0) / 100;
        else if (action.operation === "multiply") current *= Number(action.value) || 0;
        else if (action.operation === "add") current += Number(action.value) || 0;
        else if (action.operation === "override") current = Number(action.value) || 0;
        else { skippedActions.push({ ...action, reason: "unsupported-operation" }); continue; }
        calculation[property].push({ ...action, basis: action.basis || "current", before, after: current });
      }
    }
    system[property === "cost" ? "effectiveCost" : "effectiveWeight"] = Math.max(0, current);
    calculation[property] = { baseValue, finalValue: Math.max(0, current), steps: calculation[property] };
  }
  return { system, calculation, appliedActions, skippedActions, warnings };
}
