import { isGrantedEffectLifecycleActive, resolveEquipment } from "./equipment-resolution.mjs";

export const EQUIPMENT_GRANTED_EFFECT_SOURCE = "equipmentModifierFeature";

export function collectActiveEquipmentGrantedEffects(itemSystem = {}, resolution = null, { domains = ["wearer", "source_attack"] } = {}) {
  const resolved = resolution || resolveEquipment(itemSystem);
  return (resolved.grantedEffects || []).filter(grant =>
    domains.includes(grant.domain) && isGrantedEffectLifecycleActive(itemSystem, grant)
  );
}

export function matchesEquipmentGrantedEffectScope(effectOrFlags = {}, item = null, attack = null, attackType = "") {
  const gum = effectOrFlags?.flags?.gum || effectOrFlags?.gum || effectOrFlags;
  const scope = gum?.equipmentGrant;
  if (!scope || scope.domain !== "source_attack") return true;
  if (!item || String(scope.originItemId || "") !== String(item.id || item._id || "")) return false;
  if (scope.attackType && scope.attackType !== "all" && scope.attackType !== attackType) return false;
  if (!scope.selectorField || scope.selectorField === "all" || !scope.selectorValue) return Boolean(attack);
  if (!attack) return false;
  const expected = String(scope.selectorValue).trim().toLocaleLowerCase();
  if (scope.selectorField === "group") {
    const groups = Array.isArray(attack.groups) ? attack.groups : String(attack.groups || attack.tags || "").split(",");
    return groups.some(group => String(group).trim().toLocaleLowerCase() === expected);
  }
  return String(attack[scope.selectorField] || "").trim().toLocaleLowerCase() === expected;
}

export function hasEquipmentGrantRelevantChange(changes = {}) {
  const keys = Object.keys(changes || {});
  return keys.some(key =>
    key === "system.eqp_modifiers"
    || key.startsWith("system.eqp_modifiers.")
    || key === "system.location"
    || key === "system.equipped"
    || key === "system.active"
    || key === "system.switched_on"
  ) || Boolean(changes.system && (
    Object.prototype.hasOwnProperty.call(changes.system, "eqp_modifiers")
    || Object.prototype.hasOwnProperty.call(changes.system, "location")
    || Object.prototype.hasOwnProperty.call(changes.system, "equipped")
    || Object.prototype.hasOwnProperty.call(changes.system, "active")
    || Object.prototype.hasOwnProperty.call(changes.system, "switched_on")
  ));
}
