export const PHYSICAL_FEAT_ATTRIBUTE_KEYS = Object.freeze([
  "basic_lift",
  "air_move",
  "water_move",
  "burrow_move",
  "jump_horizontal_standing",
  "jump_horizontal_running",
  "jump_vertical_standing",
  "jump_vertical_running"
]);

export const MOVEMENT_PROFILE_KEYS = Object.freeze([
  "air_move",
  "water_move",
  "burrow_move"
]);

export const JUMP_ATTRIBUTE_KEYS = Object.freeze([
  "jump_horizontal_standing",
  "jump_horizontal_running",
  "jump_vertical_standing",
  "jump_vertical_running"
]);

export const AUTOMATIC_PHYSICAL_FEAT_KEYS = Object.freeze([
  "basic_lift",
  ...JUMP_ATTRIBUTE_KEYS
]);

const THROWING_DISTANCE_TABLE = Object.freeze([
  [0.05, 3.5], [0.10, 2.5], [0.15, 2.0], [0.20, 1.5],
  [0.25, 1.2], [0.30, 1.1], [0.40, 1.0], [0.50, 0.8],
  [0.75, 0.7], [1.00, 0.6], [1.50, 0.4], [2.00, 0.3],
  [2.50, 0.25], [3.00, 0.2], [4.00, 0.15], [6.00, 0.1],
  [10.00, 0.06], [12.00, 0.05]
]);

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round = (value, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round((finiteNumber(value) + Number.EPSILON) * factor) / factor;
};

export function createPhysicalFeatAttribute({ automatic = false, enabled = true } = {}) {
  return {
    value: 0,
    mod: 0,
    temp: 0,
    passive: 0,
    points: 0,
    override: null,
    final: 0,
    final_computed: 0,
    automatic,
    enabled
  };
}

export function calculateJumpBases(basicMove) {
  const move = Math.max(0, finiteNumber(basicMove));
  const horizontalStanding = Math.max(0, ((2 * move) - 3) * 0.3048);
  const verticalStanding = Math.max(0, ((6 * move) - 10) * 0.0254);
  return {
    jump_horizontal_standing: round(horizontalStanding),
    jump_horizontal_running: round(horizontalStanding * 2),
    jump_vertical_standing: round(verticalStanding),
    jump_vertical_running: round(verticalStanding * 2)
  };
}

export function prepareBasicLiftAttribute(attributes = {}, { liftingStrength } = {}) {
  attributes.basic_lift ??= createPhysicalFeatAttribute({ automatic: true });
  const attribute = attributes.basic_lift;
  const calculatedBase = round((Math.max(0, finiteNumber(liftingStrength)) ** 2) / 10);
  const base = attribute.automatic !== false ? calculatedBase : finiteNumber(attribute.value);
  attribute.calculated_base = calculatedBase;
  attribute.final_computed = round(
    base
    + finiteNumber(attribute.mod)
    + finiteNumber(attribute.passive)
    + finiteNumber(attribute.temp)
  );
  attribute.final = attribute.override !== null && attribute.override !== undefined
    ? finiteNumber(attribute.override)
    : attribute.final_computed;
  return attribute;
}

export function calculateLiftingCapacities(basicLift) {
  const lift = Math.max(0, finiteNumber(basicLift));
  return {
    basicLiftKg: round(lift),
    oneHandedKg: round(lift * 2),
    twoHandedKg: round(lift * 8),
    extraHeavyKg: round(lift * 10),
    shoveKg: round(lift * 12),
    carryOnBackKg: round(lift * 15),
    runningShoveKg: round(lift * 24),
    shiftSlightlyKg: round(lift * 50)
  };
}

export function preparePhysicalFeatAttributes(attributes = {}, { basicMove, liftingStrength } = {}) {
  prepareBasicLiftAttribute(attributes, { liftingStrength });
  const jumpBases = calculateJumpBases(basicMove);
  const automaticBases = {
    ...jumpBases
  };
  for (const key of PHYSICAL_FEAT_ATTRIBUTE_KEYS) {
    if (key === "basic_lift") continue;
    attributes[key] ??= createPhysicalFeatAttribute({
      automatic: AUTOMATIC_PHYSICAL_FEAT_KEYS.includes(key),
      enabled: !MOVEMENT_PROFILE_KEYS.includes(key)
    });
    const attribute = attributes[key];
    const automatic = attribute.automatic !== false && AUTOMATIC_PHYSICAL_FEAT_KEYS.includes(key);
    const base = automatic ? automaticBases[key] : finiteNumber(attribute.value);
    attribute.calculated_base = automaticBases[key] ?? null;
    attribute.final_computed = round(
      base
      + finiteNumber(attribute.mod)
      + finiteNumber(attribute.passive)
      + finiteNumber(attribute.temp)
    );
    attribute.final = attribute.override !== null && attribute.override !== undefined
      ? finiteNumber(attribute.override)
      : attribute.final_computed;
  }
  return attributes;
}

export function resolveThrowingDistance({ liftingStrength, strikingStrength, basicLiftKg: suppliedBasicLiftKg, objectWeightKg } = {}) {
  const liftingST = Math.max(0, finiteNumber(liftingStrength));
  const strikingST = Math.max(0, finiteNumber(strikingStrength, liftingST));
  const weightKg = Math.max(0, finiteNumber(objectWeightKg));
  const calculatedBasicLiftKg = round((liftingST * liftingST) / 10);
  const basicLiftKg = suppliedBasicLiftKg === null || suppliedBasicLiftKg === undefined
    ? calculatedBasicLiftKg
    : Math.max(0, finiteNumber(suppliedBasicLiftKg));
  if (!(basicLiftKg > 0) || !(weightKg > 0)) {
    return { valid: false, basicLiftKg, maximumWeightKg: round(basicLiftKg * 8) };
  }

  const ratio = weightKg / basicLiftKg;
  if (ratio > 12) {
    return {
      valid: true,
      throwable: false,
      basicLiftKg,
      maximumWeightKg: round(basicLiftKg * 8),
      ratio: round(ratio),
      distanceModifier: 0,
      distanceMeters: 0,
      hands: "none"
    };
  }

  const row = THROWING_DISTANCE_TABLE.find(([maximumRatio]) => ratio <= maximumRatio)
    ?? THROWING_DISTANCE_TABLE.at(-1);
  const distanceModifier = row[1];
  const throwable = ratio <= 8;
  return {
    valid: true,
    throwable,
    basicLiftKg,
    maximumWeightKg: round(basicLiftKg * 8),
    ratio: round(ratio),
    distanceModifier,
    distanceMeters: throwable ? round(strikingST * distanceModifier * 0.9144) : 0,
    hands: ratio <= 2 ? "one" : throwable ? "two" : "none"
  };
}
