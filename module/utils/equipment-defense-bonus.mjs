import { resolveEquipment } from "./equipment-resolution.mjs";
import { evaluateGurpsRollResult } from "./gurps-roll-result.mjs";

const numeric = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Returns the equipped items whose explicitly enabled Defense Bonus applies to
 * active defenses. The resolver keeps modifier-derived bonuses in this path.
 */
export function collectActiveEquipmentDefenseBonuses(items = []) {
  return Array.from(items || []).flatMap(item => {
    if (item?.type !== "equipment") return [];
    const system = item._source?.system || item.system || {};
    const equipped = system.equipped === true || String(system.location || "").toLowerCase() === "equipped";
    if (!equipped || system.defense_bonus_active !== true) return [];
    const resolution = resolveEquipment(system);
    const bonus = numeric(resolution.properties?.defense_bonus);
    if (!bonus) return [];
    return [{ itemId: item.id, name: String(item.name || ""), bonus }];
  });
}

export function totalActiveEquipmentDefenseBonus(items = []) {
  return collectActiveEquipmentDefenseBonuses(items).reduce((total, entry) => total + entry.bonus, 0);
}

/** Adds a Defense Bonus while preserving suffixes used by Parry/Block values. */
export function applyEquipmentDefenseBonus(value, defenseBonus = 0) {
  const bonus = numeric(defenseBonus);
  const raw = String(value ?? "").trim();
  if (!bonus || !raw) return value;
  const match = raw.match(/^([+-]?\d+)(.*)$/);
  if (!match) return value;
  const resolved = `${Number(match[1]) + bonus}${match[2] || ""}`;
  return typeof value === "number" && !match[2] ? Number(resolved) : resolved;
}

/**
 * Identifies ordinary defense outcomes whose success/failure changes only due
 * to the active equipment Defense Bonus. Critical outcomes intentionally do
 * not receive this informational notice.
 */
export function evaluateDecisiveDefenseBonus({ rollTotal, uncappedTarget, cap = Infinity, defenseBonus = 0 } = {}) {
  const bonus = numeric(defenseBonus);
  const uncapped = numeric(uncappedTarget);
  const dieTotal = numeric(rollTotal);
  if (!bonus || !Number.isFinite(dieTotal)) return null;

  const finalTarget = Math.min(uncapped, cap);
  const targetWithoutBonus = Math.min(uncapped - bonus, cap);
  const withBonus = evaluateGurpsRollResult(dieTotal, finalTarget);
  const withoutBonus = evaluateGurpsRollResult(dieTotal, targetWithoutBonus);
  if (withBonus.isCriticalSuccess || withBonus.isCriticalFailure) return null;

  if (bonus > 0 && withBonus.isSuccess && !withoutBonus.isSuccess) {
    return { outcome: "success", bonus, finalTarget, targetWithoutBonus };
  }
  if (bonus < 0 && !withBonus.isSuccess && withoutBonus.isSuccess) {
    return { outcome: "failure", bonus, finalTarget, targetWithoutBonus };
  }
  return null;
}
