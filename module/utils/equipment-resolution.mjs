export const EQUIPMENT_ADJUSTMENT_STAGES = Object.freeze(["original", "base", "final_base", "final"]);

const KG_PER_POUND = 0.45359237;
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundForOutput = value => Math.round((value + Number.EPSILON) * 1e10) / 1e10;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

export const EQUIPMENT_FEATURE_TYPES = Object.freeze(["equipment_property", "equipment_descriptor", "equipment_dr", "attack_property", "attack_damage", "create_attack", "granted_effect"]);
export const EQUIPMENT_PROPERTY_PATHS = Object.freeze([
  "tech_sm", "item_hp", "item_ht", "item_dr", "holdout", "defense_bonus", "equip_time", "legality_class", "material", "quality", "max_uses"
]);

function propertyValuesEqual(base, final) {
  if (base === final) return true;
  if (base === null || base === undefined || final === null || final === undefined) return false;
  const baseText = String(base).trim();
  const finalText = String(final).trim();
  if (baseText === finalText) return true;
  if (baseText === "" || finalText === "") return false;
  const baseNumber = Number(baseText.replace(",", "."));
  const finalNumber = Number(finalText.replace(",", "."));
  return Number.isFinite(baseNumber) && Number.isFinite(finalNumber) && baseNumber === finalNumber;
}

/** Build a sheet-friendly, non-mutating view of every resolved equipment property. */
export function describeEquipmentPropertyChanges(equipment = {}, resolvedProperties = {}) {
  return Object.fromEntries(EQUIPMENT_PROPERTY_PATHS.map(path => {
    const base = clone(equipment[path]);
    const final = clone(resolvedProperties[path]);
    return [path, { base, final, changed: !propertyValuesEqual(base, final) }];
  }));
}

const ATTACK_CHANGE_LABELS = Object.freeze({
  damage_formula: "dano", damage_type: "tipo de dano", damage_nature: "natureza", armor_divisor: "divisor de armadura",
  skill_level_mod: "NH", min_strength: "ST mínima", reach: "alcance", parry: "Aparar", block: "Bloqueio",
  accuracy: "Precisão", range: "distância", rof: "cadência", shots: "tiros", rcl: "recuo", mag: "magnitude",
  follow_up_damage: "dano de acompanhamento", fragmentation_damage: "fragmentação", groups: "grupos"
});

/** Summarize resolver steps per attack without replacing editable base attack data. */
export function describeEquipmentAttackChanges(baseAttacks = {}, resolvedAttacks = {}, steps = [], attackType = "melee") {
  return Object.fromEntries(Object.entries(resolvedAttacks || {}).map(([attackId, resolved]) => {
    const base = baseAttacks?.[attackId];
    const matchingSteps = steps.filter(step => step.attackType === attackType && step.attackId === attackId);
    const labels = matchingSteps
      .map(step => step.type === "create_attack" ? "modo criado" : (ATTACK_CHANGE_LABELS[step.path] || step.path || "alteração"));
    const changed = base === undefined || JSON.stringify(base) !== JSON.stringify(resolved);
    if (changed && labels.length === 0) labels.push("alterado por modificador");
    const uniqueLabels = [...new Set(labels)];
    const sources = [...new Set(matchingSteps.map(step => step.sourceName).filter(Boolean))];
    const sourcePrefix = sources.length ? `Modificado por ${sources.join(", ")}: ` : "Modificado: ";
    return [attackId, {
      changed,
      created: base === undefined,
      labels: uniqueLabels,
      sources,
      summary: uniqueLabels.join(", "),
      title: uniqueLabels.length ? `${sourcePrefix}${uniqueLabels.join(", ")}` : ""
    }];
  }));
}

/** Convert machine-readable resolver warnings into sheet-ready diagnostics. */
export function describeEquipmentResolutionWarnings(warnings = []) {
  return warnings.map((warning, index) => {
    const source = warning.sourceName || warning.sourceId || "Modificador desconhecido";
    const messages = {
      invalid_expression: `Expressão inválida: ${warning.expression || "vazia"}.`,
      unsupported_operation: `A operação “${warning.expression || warning.operation || "?"}” não é aceita nesta etapa.`,
      unsupported_feature_path: `A propriedade “${warning.path || "?"}” não é suportada.`,
      feature_no_match: `Nenhum alvo corresponde ao filtro informado${warning.selectorValue ? ` (“${warning.selectorValue}”)` : ""}.`,
      conflicting_feature_override: `Mais de uma feature define o mesmo valor${warning.path ? ` (${warning.path})` : ""}; prevalece a última na ordem determinística.`,
      missing_effect_uuid: "A feature de efeito não possui um UUID vinculado.",
      missing_descriptor_value: "O descritor está vazio."
    };
    return { ...warning, id: `${warning.type || "warning"}-${index}`, type: warning.type || "warning", source, message: messages[warning.type] || "O ajuste não pôde ser aplicado." };
  });
}
export const ATTACK_PROPERTY_PATHS = Object.freeze([
  "skill_level_mod", "damage_formula", "damage_type", "damage_nature", "armor_divisor", "min_strength",
  "reach", "parry", "block", "accuracy", "range", "rof", "shots", "rcl", "bulk", "mag", "groups"
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
    location: String(feature.location || "all").trim(),
    damageType: String(feature.damage_type ?? feature.damageType ?? "base").trim() || "base",
    damageSlot: ["follow_up_damage", "fragmentation_damage"].includes(feature.damage_slot || feature.damageSlot) ? (feature.damage_slot || feature.damageSlot) : "follow_up_damage",
    descriptorKind: ["appearance", "craftsmanship", "material", "origin", "tag", "note"].includes(feature.descriptor_kind || feature.descriptorKind) ? (feature.descriptor_kind || feature.descriptorKind) : "appearance",
    attackType: ["melee", "ranged"].includes(feature.attack_type || feature.attackType) ? (feature.attack_type || feature.attackType) : "all",
    selectorField: ["all", "mode", "skill_name", "group"].includes(feature.selector_field || feature.selectorField) ? (feature.selector_field || feature.selectorField) : "all",
    selectorValue: String(feature.selector_value ?? feature.selectorValue ?? "").trim(),
    effectUuid: String(feature.effect_uuid ?? feature.effectUuid ?? "").trim(),
    effectDomain: ["wearer", "source_attack", "hit_target"].includes(feature.effect_domain || feature.effectDomain) ? (feature.effect_domain || feature.effectDomain) : "wearer",
    lifecycle: ["while_possessed", "while_carried", "while_equipped", "while_active"].includes(feature.lifecycle) ? feature.lifecycle : "while_equipped",
    minInjury: Math.max(0, number(feature.min_injury ?? feature.minInjury)),
    activationChance: Math.min(100, Math.max(0, number(feature.activation_chance ?? feature.activationChance, 100))),
    requiredDamageType: String(feature.required_damage_type ?? feature.requiredDamageType ?? "").trim(),
    attack: clone(feature.attack || {}),
    damage: clone(feature.damage || {})
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
  const drLocations = clone(equipment.dr_locations || {});
  const meleeAttacks = clone(equipment.melee_attacks || {});
  const rangedAttacks = clone(equipment.ranged_attacks || {});
  const steps = [];
  const grantedEffects = [];
  const descriptors = (Array.isArray(equipment.descriptors) ? clone(equipment.descriptors) : [])
    .map((descriptor, index) => typeof descriptor === "string" ? { id: `base-${index}`, kind: "tag", value: descriptor, sourceName: "Equipamento-base" } : descriptor);
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

      if (feature.type === "granted_effect") {
        if (!feature.effectUuid) {
          warnings.push({ type: "missing_effect_uuid", domain: feature.effectDomain, sourceId: modifier.id, featureId: feature.id });
          continue;
        }
        const grant = {
          id: `${modifier.id}:${feature.id}`,
          sourceModifierId: modifier.id,
          sourceModifierName: modifier.name,
          featureId: feature.id,
          label: feature.label,
          effectUuid: feature.effectUuid,
          domain: feature.effectDomain,
          lifecycle: feature.lifecycle,
          attackType: feature.attackType,
          selectorField: feature.selectorField,
          selectorValue: feature.selectorValue,
          minInjury: feature.minInjury,
          activationChance: feature.activationChance,
          requiredDamageType: feature.requiredDamageType
        };
        grantedEffects.push(grant);
        if (grant.domain === "hit_target" && isGrantedEffectLifecycleActive(equipment, grant)) {
          const collections = grant.attackType === "melee" ? [meleeAttacks]
            : grant.attackType === "ranged" ? [rangedAttacks]
              : [meleeAttacks, rangedAttacks];
          let matches = 0;
          for (const collection of collections) {
            for (const attack of Object.values(collection)) {
              if (!attackMatches(attack, feature)) continue;
              matches += 1;
              attack.onDamageEffects ||= {};
              const linkId = featureAttackKey(modifier.id, feature.id);
              attack.onDamageEffects[linkId] = {
                id: linkId,
                effectUuid: grant.effectUuid,
                name: grant.label,
                minInjury: grant.minInjury,
                activationChance: grant.activationChance,
                requiredDamageType: grant.requiredDamageType,
                sourceModifierId: modifier.id,
                sourceFeatureId: feature.id
              };
            }
          }
          if (!matches) warnings.push({ type: "feature_no_match", domain: "hit_target", sourceId: modifier.id, featureId: feature.id, selectorField: feature.selectorField, selectorValue: feature.selectorValue });
        }
        steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, effectUuid: feature.effectUuid, domain: feature.effectDomain, lifecycle: feature.lifecycle });
        continue;
      }

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

      if (feature.type === "equipment_descriptor") {
        const value = String(feature.value ?? "").trim();
        if (!value) {
          warnings.push({ type: "missing_descriptor_value", domain: "equipment", sourceId: modifier.id, featureId: feature.id });
          continue;
        }
        const descriptor = { id: `${modifier.id}:${feature.id}`, kind: feature.descriptorKind, value, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id };
        descriptors.push(descriptor);
        steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, path: `descriptor.${feature.descriptorKind}`, input: "—", output: value });
        continue;
      }

      if (feature.type === "equipment_dr") {
        const locations = feature.location === "all" ? Object.keys(drLocations) : [feature.location];
        if (!locations.length || locations.some(location => !location)) {
          warnings.push({ type: "feature_no_match", domain: "equipment_dr", sourceId: modifier.id, featureId: feature.id, location: feature.location });
          continue;
        }
        for (const location of locations) {
          drLocations[location] ||= {};
          const input = drLocations[location][feature.damageType] ?? 0;
          const output = applyFeatureValue(input, feature, scale);
          const overrideKey = `equipment_dr:${location}:${feature.damageType}`;
          if (feature.operation === "set" && overrides.has(overrideKey)) warnings.push({ type: "conflicting_feature_override", domain: "equipment_dr", location, damageType: feature.damageType, sources: [overrides.get(overrideKey), modifier.id] });
          if (feature.operation === "set") overrides.set(overrideKey, modifier.id);
          drLocations[location][feature.damageType] = output;
          steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, path: `dr_locations.${location}.${feature.damageType}`, input, output });
        }
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

      if (feature.type === "attack_damage") {
        const collections = feature.attackType === "melee" ? [["melee", meleeAttacks]]
          : feature.attackType === "ranged" ? [["ranged", rangedAttacks]]
            : [["melee", meleeAttacks], ["ranged", rangedAttacks]];
        let matches = 0;
        for (const [attackType, collection] of collections) {
          for (const [attackId, attack] of Object.entries(collection)) {
            if (!attackMatches(attack, feature)) continue;
            matches += 1;
            const input = clone(attack[feature.damageSlot] || {});
            const damage = feature.damage || {};
            const output = {
              formula: String(damage.formula || ""),
              type: String(damage.type || ""),
              nature: String(damage.nature || ""),
              armor_divisor: number(damage.armor_divisor, 1),
              scaling: String(damage.scaling || "")
            };
            const overrideKey = `attack_damage:${attackType}:${attackId}:${feature.damageSlot}`;
            if (overrides.has(overrideKey)) warnings.push({ type: "conflicting_feature_override", domain: "attack_damage", attackType, attackId, damageSlot: feature.damageSlot, sources: [overrides.get(overrideKey), modifier.id] });
            overrides.set(overrideKey, modifier.id);
            attack[feature.damageSlot] = output;
            steps.push({ type: feature.type, sourceId: modifier.id, sourceName: modifier.name, featureId: feature.id, label: feature.label, attackType, attackId, path: feature.damageSlot, input: input.formula || "—", output: output.formula || "—" });
          }
        }
        if (!matches) warnings.push({ type: "feature_no_match", domain: "attack_damage", sourceId: modifier.id, featureId: feature.id, selectorField: feature.selectorField, selectorValue: feature.selectorValue });
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
  return { properties, descriptors, drLocations, meleeAttacks, rangedAttacks, grantedEffects, steps };
}

export function resolveEquipmentUses(equipment = {}, resolvedProperties = {}) {
  const mode = equipment.uses_mode === "charges" ? "charges" : "quantity";
  const baseMax = Math.max(0, Math.floor(number(equipment.max_uses)));
  const finalMax = Math.max(0, Math.floor(number(resolvedProperties.max_uses, baseMax)));
  const spent = Math.max(0, Math.floor(number(equipment.current_uses)));
  return {
    mode,
    baseMax,
    max: finalMax,
    spent: Math.min(spent, finalMax),
    remaining: Math.max(0, finalMax - spent),
    consumeQuantityWhenEmpty: equipment.consume_quantity_when_empty === true
  };
}

/** Return persistence updates for one successful use without mutating the item. */
export function buildEquipmentConsumptionUpdate(equipment = {}, resolution = null) {
  const quantity = Math.max(0, number(equipment.quantity));
  const uses = resolution?.uses || resolveEquipmentUses(equipment, resolution?.properties || {});
  if (quantity <= 0) return { consumed: false, reason: "empty_quantity", updates: {}, uses };
  if (uses.mode !== "charges" || uses.max <= 0) {
    return { consumed: true, mode: "quantity", updates: { "system.quantity": Math.max(0, quantity - 1) }, uses };
  }
  if (uses.remaining <= 0) return { consumed: false, reason: "empty_charges", updates: {}, uses };

  const exhausted = uses.remaining === 1;
  if (exhausted && uses.consumeQuantityWhenEmpty) {
    const nextQuantity = Math.max(0, quantity - 1);
    return { consumed: true, mode: "charges", exhausted: true, updates: { "system.quantity": nextQuantity, "system.current_uses": nextQuantity > 0 ? 0 : uses.max }, uses };
  }
  return { consumed: true, mode: "charges", exhausted, updates: { "system.current_uses": Math.min(uses.max, uses.spent + 1) }, uses };
}

export function isGrantedEffectLifecycleActive(itemSystem = {}, grant = {}) {
  const location = String(itemSystem.location || "").toLowerCase();
  if (grant.lifecycle === "while_possessed") return true;
  if (grant.lifecycle === "while_carried") return location === "carried" || location === "equipped";
  if (grant.lifecycle === "while_active") return itemSystem.active === true || itemSystem.switched_on === true;
  return location === "equipped" || itemSystem.equipped === true;
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
  const uses = resolveEquipmentUses(equipment, featureResolution.properties);

  weight.extendedFinal = roundForOutput(weight.unitFinal * quantity);
  cost.extendedFinal = roundForOutput(cost.unitFinal * quantity);

  return {
    quantity,
    modifiers,
    cost,
    weight,
    uses,
    ...featureResolution,
    features: modifiers.filter(modifier => modifier.enabled).flatMap(modifier => modifier.features.map(feature => ({ ...feature, sourceModifierId: modifier.id, sourceModifierName: modifier.name }))),
    warnings
  };
}
