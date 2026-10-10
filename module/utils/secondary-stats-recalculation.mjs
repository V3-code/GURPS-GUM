import { addBasicDamageModifier } from "./basic-damage.mjs";

const hasOverride = attribute => attribute?.override !== null && attribute?.override !== undefined;
const number = value => Number(value) || 0;

export const formatBasicDamageDiceCount = diceCount => `${Math.max(0, Math.floor(Number(diceCount) || 0))}d6`;

/** Uses the same prepared value displayed by the sheet, with safe fallbacks for unprepared test/data contexts. */
export function getPreparedPrimaryAttributeValue(attribute) {
  for (const candidate of [attribute?.final, attribute?.final_computed, attribute?.value]) {
    if (candidate !== null && candidate !== undefined && candidate !== "" && Number.isFinite(Number(candidate))) {
      return Number(candidate);
    }
  }
  return 0;
}

function translated(options, key, data, fallback) {
  if (typeof options?.localize !== "function") return fallback;
  const localized = options.localize(key, data);
  return localized && localized !== key ? localized : fallback;
}

function primaryReason(label, attribute, preparedValue, options) {
  const base = number(attribute?.value);
  const difference = preparedValue - base;
  if (Math.abs(difference) < 1e-9) {
    return translated(options, "GUM.SecondaryRecalculation.Reason.PrimaryFinal", { attribute: label, value: preparedValue }, `${label} final ${preparedValue}`);
  }
  const sign = difference >= 0 ? "+" : "";
  return translated(options, "GUM.SecondaryRecalculation.Reason.PrimaryWithAdditions", {
    attribute: label, value: preparedValue, base, difference: `${sign}${difference}`
  }, `${label} final ${preparedValue} (base ${base}, adicionais ${sign}${difference})`);
}

export function secondaryStatValuesEqual(left, right, precision = null) {
  if (typeof left === "number" && typeof right === "number") {
    const tolerance = precision === null ? 1e-9 : (0.5 * (10 ** -precision));
    return Math.abs(left - right) < tolerance;
  }
  return String(left ?? "") === String(right ?? "");
}

function estimatedFinal(attribute, proposedBase, { pool = false } = {}) {
  if (!attribute || hasOverride(attribute)) return attribute?.final;
  return number(proposedBase) + number(attribute.mod) + number(attribute.passive) + number(attribute.temp);
}

/** Builds a side-effect-free snapshot of every value handled by the sidebar recalculate action. */
export function buildSecondaryStatsRecalculationPlan(system, getBasicDamageFromST, options = {}) {
  const { considerBasicSpeedFixedModifier = false } = options;
  const attrs = system?.attributes || {};
  const st = getPreparedPrimaryAttributeValue(attrs.st);
  const dx = getPreparedPrimaryAttributeValue(attrs.dx);
  const ht = getPreparedPrimaryAttributeValue(attrs.ht);
  const per = getPreparedPrimaryAttributeValue(attrs.per);
  const sourceReasons = {
    st: primaryReason("ST", attrs.st, st, options),
    dx: primaryReason("DX", attrs.dx, dx, options),
    ht: primaryReason("HT", attrs.ht, ht, options),
    per: primaryReason("Per", attrs.per, per, options)
  };
  const speed = Math.round((((dx + ht) / 4) + Number.EPSILON) * 100) / 100;
  const derivedSpeed = speed + (considerBasicSpeedFixedModifier ? number(attrs.basic_speed?.mod) : 0);
  const speedFinal = estimatedFinal(attrs.basic_speed, speed);
  const damage = getBasicDamageFromST(st);

  const label = (id, fallback) => translated(options, `GUM.SecondaryRecalculation.Attributes.${id}`, {}, fallback);
  const from = source => translated(options, "GUM.SecondaryRecalculation.Reason.CalculatedFrom", { source }, `Calculado a partir de ${source}`);
  const definitions = [
    ["hp-max", "resources", label("HitPointsMaximum", "PV Máximo"), "system.attributes.hp.max", attrs.hp?.max, st, from(sourceReasons.st), ["st"], { pool: true }],
    ["fp-max", "resources", label("FatiguePointsMaximum", "PF Máximo"), "system.attributes.fp.max", attrs.fp?.max, ht, from(sourceReasons.ht), ["ht"], { pool: true }],
    ["lifting-st", "physical", label("LiftingStrength", "ST de Levantamento"), "system.attributes.lifting_st.value", attrs.lifting_st?.value, st, from(sourceReasons.st), ["st"]],
    ["basic-speed", "movement", label("BasicSpeed", "Velocidade Básica"), "system.attributes.basic_speed.value", attrs.basic_speed?.value, speed, translated(options, "GUM.SecondaryRecalculation.Reason.CalculatedFromTwo", { first: sourceReasons.dx, second: sourceReasons.ht }, `Calculada a partir de ${sourceReasons.dx} e ${sourceReasons.ht}`), ["dx", "ht"], { precision: 2 }],
    ["basic-move", "movement", label("BasicMove", "Deslocamento Básico"), "system.attributes.basic_move.value", attrs.basic_move?.value, Math.floor(derivedSpeed), translated(options, considerBasicSpeedFixedModifier ? "GUM.SecondaryRecalculation.Reason.MoveWithFixed" : "GUM.SecondaryRecalculation.Reason.MoveFromNewSpeed", {}, considerBasicSpeedFixedModifier ? "Calculado a partir da Velocidade Básica com seu modificador fixo" : "Calculado a partir da nova Velocidade Básica"), ["basic-speed"]],
    ["dodge", "movement", label("DodgeBase", "Esquiva-base"), "system.attributes.dodge.value", attrs.dodge?.value, Math.floor(derivedSpeed) + 3, translated(options, considerBasicSpeedFixedModifier ? "GUM.SecondaryRecalculation.Reason.DodgeWithFixed" : "GUM.SecondaryRecalculation.Reason.DodgeFromProposedSpeed", {}, considerBasicSpeedFixedModifier ? "Calculada pela Velocidade Básica com seu modificador fixo" : "Calculada pela mesma Velocidade Básica proposta"), ["basic-speed"], { dodge: true }],
    ["vision", "senses", label("Vision", "Visão"), "system.attributes.vision.value", attrs.vision?.value, per, from(sourceReasons.per), ["per"]],
    ["hearing", "senses", label("Hearing", "Audição"), "system.attributes.hearing.value", attrs.hearing?.value, per, from(sourceReasons.per), ["per"]],
    ["tastesmell", "senses", label("TasteSmell", "Paladar/Olfato"), "system.attributes.tastesmell.value", attrs.tastesmell?.value, per, from(sourceReasons.per), ["per"]],
    ["touch", "senses", label("Touch", "Tato"), "system.attributes.touch.value", attrs.touch?.value, per, from(sourceReasons.per), ["per"]],
    ["thrust-damage", "damage", label("Thrust", "Golpe de Ponta"), "system.attributes.thrust_damage.value", attrs.thrust_damage?.value ?? attrs.thrust_damage, damage.thrust, translated(options, "GUM.SecondaryRecalculation.Reason.DamageTable", { source: sourceReasons.st }, `Calculado pela tabela de dano para ${sourceReasons.st}`), ["st"], { damage: true }],
    ["swing-damage", "damage", label("Swing", "Golpe em Balanço"), "system.attributes.swing_damage.value", attrs.swing_damage?.value ?? attrs.swing_damage, damage.swing, translated(options, "GUM.SecondaryRecalculation.Reason.DamageTable", { source: sourceReasons.st }, `Calculado pela tabela de dano para ${sourceReasons.st}`), ["st"], { damage: true }]
  ];

  return definitions.map(([id, group, label, path, currentValue, proposedValue, reason, dependencies, entryOptions = {}]) => {
    const attributeKey = path.match(/^system\.attributes\.([^.]+)/)?.[1];
    const attribute = attrs[attributeKey];
    const protectedByOverride = hasOverride(attribute);
    const removeImportedFixed = entryOptions.dodge && attrs.dodge?.gcs_imported_fixed !== null
      && attrs.dodge?.gcs_imported_fixed !== undefined && attrs.dodge?.gcs_imported_fixed !== "";
    const changed = !protectedByOverride && (!secondaryStatValuesEqual(currentValue, proposedValue, entryOptions.precision) || removeImportedFixed);
    let proposedFinal = estimatedFinal(attribute, proposedValue, { pool: entryOptions.pool });
    if (entryOptions.damage) proposedFinal = hasOverride(attribute) ? attribute.final : addBasicDamageModifier(proposedValue, number(attribute?.mod) + number(attribute?.passive) + number(attribute?.temp));
    if (entryOptions.dodge) proposedFinal = Math.floor(number(speedFinal)) + 3 + number(attribute?.mod) + number(attribute?.passive) + number(attribute?.temp);
    const currentFinal = attribute?.final ?? attribute?.final_computed;
    const warnings = [];
    if (entryOptions.pool && proposedValue < number(attribute?.value)) warnings.push(translated(options, "GUM.SecondaryRecalculation.Warning.LowerMaximum", {}, "O novo máximo é inferior ao valor atual; o valor atual será preservado."));
    if (removeImportedFixed && !protectedByOverride) warnings.push(translated(options, "GUM.SecondaryRecalculation.Warning.RemoveImportedDodge", {}, "A seleção também removerá o valor fixo importado da Esquiva."));
    return {
      id, group, label, path, currentValue, proposedValue, currentFinal, proposedFinal,
      changed, visible: changed || protectedByOverride, selectedByDefault: changed, protectedByOverride, removeImportedFixed,
      reason: protectedByOverride ? translated(options, "GUM.SecondaryRecalculation.ProtectedByOverride", {}, "Protegido por override") : reason, dependencies, warnings,
      modifierTotal: attribute ? number(attribute.mod) + number(attribute.passive) + number(attribute.temp) : null
    };
  });
}

export function buildSecondaryStatsUpdateData(plan, selectedIds) {
  const selected = new Set(selectedIds || []);
  const updateData = {};
  for (const entry of plan || []) {
    if (!selected.has(entry.id) || !entry.changed || entry.protectedByOverride) continue;
    updateData[entry.path] = entry.proposedValue;
    if (entry.id === "dodge" && entry.removeImportedFixed) {
      updateData["system.attributes.dodge.-=gcs_imported_fixed"] = null;
    }
  }
  return updateData;
}
