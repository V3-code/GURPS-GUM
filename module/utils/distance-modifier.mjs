export const DISTANCE_MODIFIER_ENABLED_SETTING = "autoDistanceModifierEnabled";
export const DISTANCE_MODIFIER_TABLE_SETTING = "autoDistanceModifierTable";

export const STANDARD_DISTANCE_BANDS = Object.freeze([
  { max: 0.005, mod: 0 }, { max: 0.008, mod: 0 }, { max: 0.012, mod: 0 },
  { max: 0.017, mod: 0 }, { max: 0.025, mod: 0 }, { max: 0.038, mod: 0 },
  { max: 0.05, mod: 0 }, { max: 0.075, mod: 0 }, { max: 0.125, mod: 0 },
  { max: 0.2, mod: 0 }, { max: 0.3, mod: 0 }, { max: 0.45, mod: 0 },
  { max: 0.6, mod: 0 }, { max: 1, mod: 0 }, { max: 1.5, mod: 0 },
  { max: 2, mod: 0 }, { max: 3, mod: -1 }, { max: 5, mod: -2 },
  { max: 7, mod: -3 }, { max: 10, mod: -4 }, { max: 15, mod: -5 },
  { max: 20, mod: -6 }, { max: 30, mod: -7 }, { max: 50, mod: -8 },
  { max: 70, mod: -9 }, { max: 100, mod: -10 }, { max: 150, mod: -11 },
  { max: 200, mod: -12 }, { max: 300, mod: -13 }, { max: 500, mod: -14 },
  { max: 700, mod: -15 }, { max: 1000, mod: -16 }, { max: 1500, mod: -17 },
  { max: 2000, mod: -18 }, { max: 3000, mod: -19 }, { max: 5000, mod: -20 },
  { max: 7000, mod: -21 }, { max: 10000, mod: -22 }, { max: 15000, mod: -23 },
  { max: 20000, mod: -24 }, { max: 30000, mod: -25 }, { max: 50000, mod: -26 },
  { max: 70000, mod: -27 }, { max: 100000, mod: -28 }, { max: 150000, mod: -29 },
  { max: 200000, mod: -30 }
].map(Object.freeze));

export const MONSTER_HUNTERS_DISTANCE_BANDS = Object.freeze([
  { max: 5, mod: 0 },
  { max: 20, mod: -3 },
  { max: 100, mod: -7 },
  { max: 500, mod: -11 },
  { max: Infinity, mod: -15 }
].map(Object.freeze));

export const HYBRID_DISTANCE_BANDS = Object.freeze([
  { max: 5, mod: 0 },
  { max: 10, mod: -3 },
  { max: 15, mod: -5 },
  ...STANDARD_DISTANCE_BANDS.filter(band => band.max > 15)
].map(Object.freeze));

export function getDistanceModifier(distance, tableKey = "standard") {
  const numericDistance = Math.max(0, Number(distance) || 0);
  const bands = tableKey === "monster_hunters"
    ? MONSTER_HUNTERS_DISTANCE_BANDS
    : tableKey === "hybrid"
      ? HYBRID_DISTANCE_BANDS
      : STANDARD_DISTANCE_BANDS;
  const foundBand = bands.find(band => numericDistance <= band.max);
  if (foundBand) return foundBand.mod;
  if (tableKey === "monster_hunters") return -15;

  const overflow = Math.max(0, numericDistance - 200000);
  return -30 - Math.ceil(overflow / 50000);
}

export function formatDistanceModifier(modifier) {
  const numeric = Number(modifier);
  if (!Number.isFinite(numeric)) return "";
  if (numeric > 0) return `+${numeric}`;
  if (numeric < 0) return `−${Math.abs(numeric)}`;
  return "0";
}
