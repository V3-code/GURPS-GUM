import { isGrantedEffectLifecycleActive, resolveEquipment } from "./equipment-resolution.mjs";

export const EQUIPMENT_GRANTED_EFFECT_SOURCE = "equipmentModifierFeature";

export function collectActiveEquipmentGrantedEffects(itemSystem = {}, resolution = null) {
  const resolved = resolution || resolveEquipment(itemSystem);
  return (resolved.grantedEffects || []).filter(grant =>
    grant.domain === "wearer" && isGrantedEffectLifecycleActive(itemSystem, grant)
  );
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

