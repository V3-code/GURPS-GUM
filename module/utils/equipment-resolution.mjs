export const EQUIPMENT_ADJUSTMENT_STAGES = Object.freeze(["original", "base", "final_base", "final"]);

const KG_PER_POUND = 0.45359237;
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundForOutput = value => Math.round((value + Number.EPSILON) * 1e10) / 1e10;

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
    features: Array.isArray(modifier.features_data) ? modifier.features_data : []
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

  weight.extendedFinal = roundForOutput(weight.unitFinal * quantity);
  cost.extendedFinal = roundForOutput(cost.unitFinal * quantity);

  return {
    quantity,
    modifiers,
    cost,
    weight,
    features: modifiers.filter(modifier => modifier.enabled).flatMap(modifier => modifier.features.map(feature => ({ ...feature, sourceModifierId: modifier.id, sourceModifierName: modifier.name }))),
    warnings
  };
}
