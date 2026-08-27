const hasOverride = attribute => attribute?.override !== null && attribute?.override !== undefined;
const number = value => Number(value) || 0;
const localizeText = (i18n, key, fallback) => i18n?.localize ? i18n.localize(key) : fallback;
const formatText = (i18n, key, data, fallback) => i18n?.format ? i18n.format(key, data) : fallback;

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

function primaryReason(label, attribute, preparedValue, i18n = null) {
  const base = number(attribute?.value);
  const difference = preparedValue - base;
  if (Math.abs(difference) < 1e-9) {
    return formatText(i18n, "GUM.SecondaryStatsRecalculation.PrimaryFinal", { label, final: preparedValue }, `${label} final ${preparedValue}`);
  }
  const sign = difference >= 0 ? "+" : "";
  return formatText(
    i18n,
    "GUM.SecondaryStatsRecalculation.PrimaryAdjusted",
    { label, final: preparedValue, base, difference: `${sign}${difference}` },
    `${label} final ${preparedValue} (base ${base}, adicionais ${sign}${difference})`
  );
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
export function buildSecondaryStatsRecalculationPlan(system, getBasicDamageFromST, i18n = null) {
  const attrs = system?.attributes || {};
  const st = getPreparedPrimaryAttributeValue(attrs.st);
  const dx = getPreparedPrimaryAttributeValue(attrs.dx);
  const ht = getPreparedPrimaryAttributeValue(attrs.ht);
  const per = getPreparedPrimaryAttributeValue(attrs.per);
  const sourceReasons = {
    st: primaryReason("ST", attrs.st, st, i18n),
    dx: primaryReason("DX", attrs.dx, dx, i18n),
    ht: primaryReason("HT", attrs.ht, ht, i18n),
    per: primaryReason(localizeText(i18n, "GUM.SecondaryStatsRecalculation.PerceptionAbbreviation", "Per"), attrs.per, per, i18n)
  };
  const speed = Math.round((((dx + ht) / 4) + Number.EPSILON) * 100) / 100;
  const speedFinal = estimatedFinal(attrs.basic_speed, speed);
  const damage = getBasicDamageFromST(st);
  const label = (key, fallback) => localizeText(i18n, `GUM.SecondaryStatsRecalculation.Entries.${key}`, fallback);
  const from = (source, fallback) => formatText(i18n, "GUM.SecondaryStatsRecalculation.Reasons.CalculatedFrom", { source }, fallback);

  const definitions = [
    ["hp-max", "resources", label("HPMax", "PV Máximo"), "system.attributes.hp.max", attrs.hp?.max, st, from(sourceReasons.st, `Calculado a partir de ${sourceReasons.st}`), ["st"], { pool: true }],
    ["fp-max", "resources", label("FPMax", "PF Máximo"), "system.attributes.fp.max", attrs.fp?.max, ht, from(sourceReasons.ht, `Calculado a partir de ${sourceReasons.ht}`), ["ht"], { pool: true }],
    ["lifting-st", "physical", label("LiftingST", "ST de Levantamento"), "system.attributes.lifting_st.value", attrs.lifting_st?.value, st, from(sourceReasons.st, `Calculada a partir de ${sourceReasons.st}`), ["st"]],
    ["basic-speed", "movement", label("BasicSpeed", "Velocidade Básica"), "system.attributes.basic_speed.value", attrs.basic_speed?.value, speed, formatText(i18n, "GUM.SecondaryStatsRecalculation.Reasons.BasicSpeed", { dx: sourceReasons.dx, ht: sourceReasons.ht }, `Calculada a partir de ${sourceReasons.dx} e ${sourceReasons.ht}`), ["dx", "ht"], { precision: 2 }],
    ["basic-move", "movement", label("BasicMove", "Deslocamento Básico"), "system.attributes.basic_move.value", attrs.basic_move?.value, Math.floor(speed), localizeText(i18n, "GUM.SecondaryStatsRecalculation.Reasons.BasicMove", "Calculado a partir da nova Velocidade Básica"), ["basic-speed"]],
    ["dodge", "movement", label("Dodge", "Esquiva-base"), "system.attributes.dodge.value", attrs.dodge?.value, Math.floor(speed) + 3, localizeText(i18n, "GUM.SecondaryStatsRecalculation.Reasons.Dodge", "Calculada pela mesma Velocidade Básica proposta"), ["basic-speed"], { dodge: true }],
    ["vision", "senses", label("Vision", "Visão"), "system.attributes.vision.value", attrs.vision?.value, per, from(sourceReasons.per, `Calculada a partir de ${sourceReasons.per}`), ["per"]],
    ["hearing", "senses", label("Hearing", "Audição"), "system.attributes.hearing.value", attrs.hearing?.value, per, from(sourceReasons.per, `Calculada a partir de ${sourceReasons.per}`), ["per"]],
    ["tastesmell", "senses", label("TasteSmell", "Paladar/Olfato"), "system.attributes.tastesmell.value", attrs.tastesmell?.value, per, from(sourceReasons.per, `Calculado a partir de ${sourceReasons.per}`), ["per"]],
    ["touch", "senses", label("Touch", "Tato"), "system.attributes.touch.value", attrs.touch?.value, per, from(sourceReasons.per, `Calculado a partir de ${sourceReasons.per}`), ["per"]],
    ["thrust-damage", "damage", label("ThrustDamage", "Golpe de Ponta"), "system.attributes.thrust_damage", attrs.thrust_damage, damage.thrust, formatText(i18n, "GUM.SecondaryStatsRecalculation.Reasons.DamageTable", { source: sourceReasons.st }, `Calculado pela tabela de dano para ${sourceReasons.st}`), ["st"]],
    ["swing-damage", "damage", label("SwingDamage", "Golpe em Balanço"), "system.attributes.swing_damage", attrs.swing_damage, damage.swing, formatText(i18n, "GUM.SecondaryStatsRecalculation.Reasons.DamageTable", { source: sourceReasons.st }, `Calculado pela tabela de dano para ${sourceReasons.st}`), ["st"]]
  ];

  return definitions.map(([id, group, label, path, currentValue, proposedValue, reason, dependencies, options = {}]) => {
    const attributeKey = path.match(/^system\.attributes\.([^.]+)/)?.[1];
    const attribute = attrs[attributeKey];
    const protectedByOverride = hasOverride(attribute);
    const removeImportedFixed = options.dodge && attrs.dodge?.gcs_imported_fixed !== null
      && attrs.dodge?.gcs_imported_fixed !== undefined && attrs.dodge?.gcs_imported_fixed !== "";
    const changed = !protectedByOverride && (!secondaryStatValuesEqual(currentValue, proposedValue, options.precision) || removeImportedFixed);
    let proposedFinal = estimatedFinal(attribute, proposedValue, { pool: options.pool });
    if (options.dodge) proposedFinal = Math.floor(number(speedFinal)) + 3 + number(attribute?.mod) + number(attribute?.passive) + number(attribute?.temp);
    const currentFinal = attribute?.final ?? attribute?.final_computed;
    const warnings = [];
    if (options.pool && proposedValue < number(attribute?.value)) warnings.push(localizeText(i18n, "GUM.SecondaryStatsRecalculation.Warnings.MaximumBelowCurrent", "O novo máximo é inferior ao valor atual; o valor atual será preservado."));
    if (removeImportedFixed && !protectedByOverride) warnings.push(localizeText(i18n, "GUM.SecondaryStatsRecalculation.Warnings.RemoveImportedDodge", "A seleção também removerá o valor fixo importado da Esquiva."));
    return {
      id, group, label, path, currentValue, proposedValue, currentFinal, proposedFinal,
      changed, visible: changed || protectedByOverride, selectedByDefault: changed, protectedByOverride, removeImportedFixed,
      reason: protectedByOverride ? localizeText(i18n, "GUM.SecondaryStatsRecalculation.ProtectedByOverride", "Protegido por override") : reason, dependencies, warnings,
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