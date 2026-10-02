export const EQUIPMENT_ADJUSTMENT_STAGES = Object.freeze(["original", "base", "final_base", "final"]);

const KG_PER_POUND = 0.45359237;
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundForOutput = value => Math.round((value + Number.EPSILON) * 1e10) / 1e10;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export const EQUIPMENT_FEATURE_TYPES = Object.freeze(["equipment_property", "attack_property", "create_attack"]);
export const EQUIPMENT_PROPERTY_PATHS = Object.freeze([
  "tech_sm", "item_hp", "item_ht", "item_dr", "holdout", "legality_class", "material", "quality", "max_uses"
]);
export const ATTACK_PROPERTY_PATHS = Object.freeze([
  "skill_level_mod", "damage_formula", "damage_type", "damage_nature", "armor_divisor", "min_strength",
  "reach", "parry", "block", "accuracy", "range", "rof", "shots", "rcl", "mag", "groups"
]);

function parseFraction(value) {
  const source = String(value ?? "").trim().replace(",", ".");
  const match = source.match(/^([+-]?\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/);
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = match[2] ? Number(match[2]) : 1;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function weightToKg(value, unit = "kg") {
  if (unit === "g") return value / 1000;
  if (unit === "lb" || unit === "lbs") return value * KG_PER_POUND;
  if (unit === "oz") return value * KG_PER_POUND / 16;
  return value;
}

/** Parse a user-facing equipment adjustment without evaluating it. */
export function parseEquipmentAdjustment(expression, { target = "cost", stage = "original" } = {}) {
  const source = String(expression ?? "").trim();
  if (!source) return { valid: true, operation: "none", value: 0, expression: "" };
  const normalized = source.replace(/,/g, ".").trim();

  if (target === "cost") {
    const cf = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*cf$/i);
    if (cf) return { valid: true, operation: "cost_factor", value: Number(cf[1]), expression: source };
  }

  const percentMultiplier = normalized.match(/^[x*]\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*%$/i);
  if (percentMultiplier) {
    const value = parseFraction(percentMultiplier[1]);
    return value === null
      ? { valid: false, operation: "invalid", value: 0, expression: source }
      : { valid: true, operation: "percent_multiplier", value, expression: source };
  }

  const percent = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
  if (percent) return { valid: true, operation: "percent", value: Number(percent[1]), expression: source };

  const multiplier = normalized.match(/^[x*]\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)$/i);
  if (multiplier) {
    const value = parseFraction(multiplier[1]);
    return value === null
      ? { valid: false, operation: "invalid", value: 0, expression: source }
      : { valid: true, operation: "multiply", value, expression: source };
  }

  if (target === "weight") {
    const fixedWeight = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*(kg|g|lb|lbs|oz)?$/i);
    if (fixedWeight) {
      const unit = (fixedWeight[2] || "kg").toLowerCase();
      return {
        valid: true,
        operation: "add",
        value: weightToKg(Number(fixedWeight[1]), unit),
        unit,
        expression: source
      };
    }
  } else {
    const fixed = normalized.match(/^([+-]?\d+(?:\.\d+)?)$/);
    if (fixed) return { valid: true, operation: "add", value: Number(fixed[1]), expression: source };
  }

  return { valid: false, operation: "invalid", value: 0, expression: source, stage };
}

function legacyCostExpression(modifier) {
  if (String(modifier?.cost_adjustment ?? "").trim()) return String(modifier.cost_adjustment).trim();
  const cf = number(modifier?.cost_factor);
  return `${cf >= 0 ? "+" : ""}${cf} CF`;
}

/** Normalize current and legacy modifier records into one calculation contract. */
export function normalizeEquipmentModifier(modifier = {}, index = 0) {
  const costData = modifier.cost_adjustment_data || {};
  const weightData = modifier.weight_adjustment_data || {};
  const legacyCost = legacyCostExpression(modifier);
  const structuredCost = String(costData.expression ?? "").trim();
  const usesStructuredSchema = number(modifier.adjustment_schema) >= 1;
  const costExpression = structuredCost && (usesStructuredSchema || !(structuredCost === "0 CF" && legacyCost !== "0 CF"))
    ? structuredCost
    : legacyCost;
  const legacyWeight = String(modifier.weight_mod ?? "x1").trim();
  const structuredWeight = String(weightData.expression ?? "").trim();
  const weightExpression = structuredWeight && (usesStructuredSchema || !(structuredWeight === "x1" && legacyWeight !== "x1"))
    ? structuredWeight
    : legacyWeight;
  return {
    id: modifier.id || modifier._id || `modifier-${index}`,
    name: modifier.name || `Modificador ${index + 1}`,
    enabled: modifier.enabled !== false && modifier.disabled !== true,
    level: Math.max(0, number(modifier.level, 1)),
    sourceUuid: modifier.source_uuid || modifier.sourceUuid || null,
    cost: {
      expression: costExpression,
      stage: EQUIPMENT_ADJUSTMENT_STAGES.includes(costData.stage) ? costData.stage : "base",
      perLevel: costData.per_level === true || costData.perLevel === true,
      perWeight: costData.per_weight === true || costData.perWeight === true,
      perWeightUnit: costData.per_weight_unit || costData.perWeightUnit || "kg"
    },
    weight: {
      expression: weightExpression,
      stage: EQUIPMENT_ADJUSTMENT_STAGES.includes(weightData.stage) ? weightData.stage : "base",
      perLevel: weightData.per_level === true || weightData.perLevel === true
    },
    features: (Array.isArray(modifier.features_data) ? modifier.features_data : Object.values(modifier.features_data || {}))
      .map((feature, featureIndex) => normalizeEquipmentFeature(feature, featureIndex))
  };
}

export function normalizeEquipmentFeature(feature = {}, index = 0) {
  const type = EQUIPMENT_FEATURE_TYPES.includes(feature.type) ? feature.type : "equipment_property";
  return {
    ...clone(feature),
    id: feature.id || feature._id || `feature-${index}`,
    label: String(feature.label || "Feature").trim(),
    enabled: feature.enabled !== false,
    type,
    operation: ["add", "multiply", "set"].includes(feature.operation) ? feature.operation : "add",
    value: feature.value ?? 0,
    perLevel: feature.per_level === true || feature.perLevel === true,
    path: String(feature.path || (type === "attack_property" ? "damage_formula" : "item_dr")),
    attackType: ["melee", "ranged"].includes(feature.attack_type || feature.attackType) ? (feature.attack_type || feature.attackType) : "all",
    selectorField: ["all", "mode", "skill_name", "group"].includes(feature.selector_field || feature.selectorField) ? (feature.selector_field || feature.selectorField) : "all",
    selectorValue: String(feature.selector_value ?? feature.selectorValue ?? "").trim(),
    attack: clone(feature.attack || {})
  };
}

function scaleFor(adjustment, modifier, resolvedWeight) {
  let scale = adjustment.perLevel ? modifier.level : 1;
  if (adjustment.perWeight) {
    const weightUnits = adjustment.perWeightUnit === "lb"
      ? resolvedWeight / KG_PER_POUND
      : resolvedWeight;
    scale *= weightUnits;
  }
  return scale;
}

function allowedOperation(target, stage, operation) {
  if (operation === "none") return true;
  if (target === "cost" && stage === "base") return ["cost_factor", "multiply"].includes(operation);
  if (target === "weight" && stage === "original") return ["add", "percent"].includes(operation);
  if (target === "weight") return ["add", "multiply", "percent_multiplier"].includes(operation);
  return ["add", "multiply", "percent"].includes(operation);
}

function resolveNonBaseStage(input, entries, { target, stage, warnings, steps }) {
  let multiplied = input;
  let additions = 0;
  let percentages = 0;

  for (const entry of entries) {
    const { parsed, scale, modifier } = entry;
    if (!allowedOperation(target, stage, parsed.operation)) {
      warnings.push({ type: "unsupported_operation", target, stage, sourceId: modifier.id, sourceName: modifier.name, expression: parsed.expression });
      continue;
    }
    if (parsed.operation === "multiply") multiplied *= parsed.value * scale;
    else if (parsed.operation === "percent_multiplier") multiplied *= (parsed.value * scale) / 100;
    else if (parsed.operation === "add") additions += parsed.value * scale;
    else if (parsed.operation === "percent") percentages += parsed.value * scale;
  }

  const output = Math.max(0, multiplied + additions + (input * percentages / 100));
  if (entries.length) steps.push({ stage, input: roundForOutput(input), output: roundForOutput(output), entries: entries.map(entry => ({ sourceId: entry.modifier.id, sourceName: entry.modifier.name, expression: entry.parsed.expression, operation: entry.parsed.operation, scale: entry.scale })) });
  return output;
}

function resolveCostBaseStage(input, entries, warnings, steps) {
  let totalFactor = 0;
  const applied = [];
  for (const entry of entries) {
    const { parsed, scale, modifier } = entry;
    if (!allowedOperation("cost", "base", parsed.operation)) {
      warnings.push({ type: "unsupported_operation", target: "cost", stage: "base", sourceId: modifier.id, sourceName: modifier.name, expression: parsed.expression });
      continue;
    }
    if (parsed.operation === "cost_factor") totalFactor += parsed.value * scale;
    if (parsed.operation === "multiply") totalFactor += ((parsed.value * scale) - 1);
    applied.push({ sourceId: modifier.id, sourceName: modifier.name, expression: parsed.expression, operation: parsed.operation, scale });
  }
  const factor = 1 + Math.max(-0.8, totalFactor);
  const output = Math.max(0, input * factor);
  if (entries.length) steps.push({ stage: "base", input: roundForOutput(input), output: roundForOutput(output), factor: roundForOutput(factor), entries: applied });
  return output;
}

function collectEntries(modifiers, target, resolvedWeight, warnings) {
  const byStage = Object.fromEntries(EQUIPMENT_ADJUSTMENT_STAGES.map(stage => [stage, []]));
  for (const modifier of modifiers) {
    if (!modifier.enabled) continue;
    const adjustment = modifier[target];
    const parsed = parseEquipmentAdjustment(adjustment.expression, { target, stage: adjustment.stage });
    if (!parsed.valid) {
      warnings.push({ type: "invalid_expression", target, stage: adjustment.stage, sourceId: modifier.id, sourceName: modifier.name, expression: adjustment.expression });
      continue;
    }
    const scale = scaleFor(adjustment, modifier, resolvedWeight);
    if (scale === 0 || parsed.operation === "none" || (parsed.operation === "multiply" && parsed.value * scale === 1)) continue;
    byStage[adjustment.stage].push({ modifier, parsed, scale });
  }
  return byStage;
}

function resolveWeight(baseWeight, modifiers, warnings) {
  const steps = [];
  const entries = collectEntries(modifiers, "weight", baseWeight, warnings);
  let value = Math.max(0, number(baseWeight));
  for (const stage of EQUIPMENT_ADJUSTMENT_STAGES) {
    value = resolveNonBaseStage(value, entries[stage], { target: "weight", stage, warnings, steps });
  }
  return { base: Math.max(0, number(baseWeight)), unitFinal: roundForOutput(value), steps };
}

function resolveCost(baseCost, resolvedWeight, modifiers, warnings) {
  const steps = [];
  const entries = collectEntries(modifiers, "cost", resolvedWeight, warnings);
  let value = Math.max(0, number(baseCost));
  value = resolveNonBaseStage(value, entries.original, { target: "cost", stage: "original", warnings, steps });
  value = resolveCostBaseStage(value, entries.base, warnings, steps);
  value = resolveNonBaseStage(value, entries.final_base, { target: "cost", stage: "final_base", warnings, steps });
  value = resolveNonBaseStage(value, entries.final, { target: "cost", stage: "final", warnings, steps });
  return { base: Math.max(0, number(baseCost)), unitFinal: roundForOutput(value), steps };
}

function numericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function addFormulaModifier(formula, amount) {
  const base = String(formula ?? "").trim();
  if (!base || !Number.isFinite(amount) || amount === 0) return base;
  return `${base}${amount > 0 ? "+" : ""}${amount}`;
}

function applyFeatureValue(current, feature, scale, { formula = false } = {}) {
  if (feature.operation === "set") return feature.value;
  const amount = numericValue(feature.value);
  if (amount === null) return current;
  const scaled = amount * scale;
  if (formula && feature.operation === "add") return addFormulaModifier(current, scaled);
  const base = numericValue(current) ?? 0;
  if (feature.operation === "multiply") return base * scaled;
  return base + scaled;
}

function attackMatches(attack, feature) {
  if (feature.selectorField === "all") return true;
  const needle = feature.selectorValue.toLocaleLowerCase();
  if (!needle) return true;
  if (feature.selectorField === "group") {
    const groups = Array.isArray(attack.groups)
      ? attack.groups
      : String(attack.groups || attack.tags || "").split(",");
    return groups.some(group => String(group).trim().toLocaleLowerCase() === needle);
  }
  return String(attack[feature.selectorField] ?? "").trim().toLocaleLowerCase() === needle;
}

function featureAttackKey(modifierId, featureId) {
  const safe = value => String(value || "feature").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `eqpmod_${safe(modifierId)}_${safe(featureId)}`;
}

function defaultCreatedAttack(type, attack = {}) {
  const common = {
    mode: attack.mode || "Novo modo",
    skill_name: attack.skill_name || "",
    skill_level_mod: number(attack.skill_level_mod),
    damage_formula: attack.damage_formula || (type === "melee" ? "GdB" : "GdP"),
    damage_type: attack.damage_type || (type === "melee" ? "cort" : "perf"),
    damage_nature: attack.damage_nature || "",
    armor_divisor: number(attack.armor_divisor, 1),
    min_strength: attack.min_strength ?? 0,
    groups: attack.groups || "",
    onDamageEffects: {},
    follow_up_damage: { formula: "", type: "", scaling: "", armor_divisor: 1, nature: "" },
    fragmentation_damage: { formula: "", type: "", scaling: "", armor_divisor: 1, nature: "" }
  };
  if (type === "melee") return { ...common, reach: attack.reach || "C", parry: attack.parry || "0", block: attack.block || "0", parry_default: attack.parry_default !== false, block_default: attack.block_default !== false, unbalanced: false, fencing: false };
  return { ...common, accuracy: attack.accuracy || "0", range: attack.range || "100/1500", rof: attack.rof || "1", shots: attack.shots || "1", rcl: attack.rcl || "1", mag: attack.mag || "1", unbalanced: false, fencing: false };
}

function resolveFeatures(equipment, modifiers, warnings) {
  const properties = Object.fromEntries(EQUIPMENT_PROPERTY_PATHS.map(path => [path, clone(equipment[path])]));
  const meleeAttacks = clone(equipment.melee_attacks || {});
  const rangedAttacks = clone(equipment.ranged_attacks || {});
  const steps = [];
  const overrides = new Map();
  const operationOrder = { set: 1, multiply: 2, add: 3 };
  const tasks = modifiers
    .filter(modifier => modifier.enabled)
    .flatMap(modifier => modifier.features
      .filter(feature => feature.enabled)
      .map(feature => ({ modifier, feature, scale: feature.perLevel ? modifier.level : 1 })))
    .filter(task => task.scale !== 0)
    .sort((a, b) => {
      const aOrder = a.feature.type === "create_attack" ? 0 : (operationOrder[a.feature.operation] ?? 4);
      const bOrder = b.feature.type === "create_attack" ? 0 : (operationOrder[b.feature.operation] ?? 4);
      return aOrder - bOrder
        || String(a.modifier.id).localeCompare(String(b.modifier.id))
        || String(a.feature.id).localeCompare(String(b.feature.id));
    });

  for (const { modifier, feature, scale } of tasks) {

      if (feature.type === "equipment_property") {
        if (!EQUIPMENT_PROPERTY_PATHS.includes(feature.path)) {
          warnings.push({ type: "unsupported_feature_path", domain: "equipment", sourceId: modifier.id, featureId: feature.id, path: feature.path });
          continue;
        }
        const input = properties[feature.path];
        const output = applyFeatureValue(input, feature, scale);
        const overrideKey = `equipment:${feature.path}`;
        if (feature.operation === "set" && overrides.has(overrideKey)) warnings.push({ type: "conflicting_feature_override", domain: "equipment", path: feature.path, sources: [overrides.get(overrideKey), modifier.id] });
        if (feature.operation === "set") overrides.set(overrideKey, modifier.id);
        properties[feature.path] = output;
        steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, path: feature.path, input, output });
        continue;
      }

      if (feature.type === "create_attack") {
        const type = feature.attackType === "ranged" ? "ranged" : "melee";
        const key = featureAttackKey(modifier.id, feature.id);
        const collection = type === "ranged" ? rangedAttacks : meleeAttacks;
        collection[key] = { ...defaultCreatedAttack(type, feature.attack), id: key, source_modifier_id: modifier.id, source_feature_id: feature.id };
        steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, attackType: type, attackId: key });
        continue;
      }

      if (feature.type === "attack_property") {
        if (!ATTACK_PROPERTY_PATHS.includes(feature.path)) {
          warnings.push({ type: "unsupported_feature_path", domain: "attack", sourceId: modifier.id, featureId: feature.id, path: feature.path });
          continue;
        }
        const collections = feature.attackType === "melee" ? [["melee", meleeAttacks]]
          : feature.attackType === "ranged" ? [["ranged", rangedAttacks]]
            : [["melee", meleeAttacks], ["ranged", rangedAttacks]];
        let matches = 0;
        for (const [attackType, collection] of collections) {
          for (const [attackId, attack] of Object.entries(collection)) {
            if (!attackMatches(attack, feature)) continue;
            matches += 1;
            const input = attack[feature.path];
            const output = applyFeatureValue(input, feature, scale, { formula: feature.path === "damage_formula" });
            const overrideKey = `attack:${attackType}:${attackId}:${feature.path}`;
            if (feature.operation === "set" && overrides.has(overrideKey)) warnings.push({ type: "conflicting_feature_override", domain: "attack", attackType, attackId, path: feature.path, sources: [overrides.get(overrideKey), modifier.id] });
            if (feature.operation === "set") overrides.set(overrideKey, modifier.id);
            attack[feature.path] = output;
            steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, attackType, attackId, path: feature.path, input, output });
          }
        }
        if (!matches) warnings.push({ type: "feature_no_match", domain: "attack", sourceId: modifier.id, featureId: feature.id, selectorField: feature.selectorField, selectorValue: feature.selectorValue });
      }
  }
  return { properties, meleeAttacks, rangedAttacks, steps };
}

/**
 * Resolve the unit and extended cost/weight for one equipment record.
 * This is pure and never mutates the equipment or its modifiers.
 */
export function resolveEquipment(equipment = {}, rawModifiers = equipment.eqp_modifiers || {}) {
  const modifierValues = Array.isArray(rawModifiers) ? rawModifiers : Object.values(rawModifiers || {});
  const modifiers = modifierValues.map(normalizeEquipmentModifier);
  const warnings = [];
  const quantity = Math.max(0, number(equipment.quantity, 1));
  const weight = resolveWeight(equipment.weight, modifiers, warnings);
  const cost = resolveCost(equipment.cost, weight.unitFinal, modifiers, warnings);
  const featureResolution = resolveFeatures(equipment, modifiers, warnings);

  weight.extendedFinal = roundForOutput(weight.unitFinal * quantity);
  cost.extendedFinal = roundForOutput(cost.unitFinal * quantity);

  return {
    quantity,
    modifiers,
    cost,
    weight,
    ...featureResolution,
    features: modifiers.filter(modifier => modifier.enabled).flatMap(modifier => modifier.features.map(feature => ({ ...feature, sourceModifierId: modifier.id, sourceModifierName: modifier.name }))),
    warnings
  };
}
