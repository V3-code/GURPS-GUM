import {
  DISTANCE_MODIFIER_ENABLED_SETTING,
  DISTANCE_MODIFIER_TABLE_SETTING,
  formatDistanceModifier,
  getDistanceModifier
} from "../utils/distance-modifier.mjs";

function finiteNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function setting(key, fallback) {
  try {
    return globalThis.game?.settings?.get?.("gum", key) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

export function buildDistanceModifierState(waypoint, tableKey = "standard") {
  const distance = finiteNumber(waypoint?.measurement?.distance);
  if (distance === null || distance < 0) return null;
  const modifier = getDistanceModifier(distance, tableKey);
  const label = formatDistanceModifier(modifier);
  return label ? { distance, modifier, label, tableKey } : null;
}

export function registerDistanceRulerIntegration(config, { generation } = {}) {
  if (finiteNumber(generation, 0) < 13) return false;

  const BaseRuler = config?.Canvas?.rulerClass;
  if (!BaseRuler?.prototype || typeof BaseRuler.prototype._getWaypointLabelContext !== "function") return false;
  if (BaseRuler.gumDistanceRuler === true) return true;

  class GumDistanceRuler extends BaseRuler {
    static WAYPOINT_LABEL_TEMPLATE = "systems/gum/templates/hud/movement-waypoint-label.hbs";
    static gumDistanceRuler = true;

    _getWaypointLabelContext(waypoint, state) {
      const context = super._getWaypointLabelContext(waypoint, state);
      if (!context || setting(DISTANCE_MODIFIER_ENABLED_SETTING, false) !== true) return context;

      const tableKey = setting(DISTANCE_MODIFIER_TABLE_SETTING, "standard") || "standard";
      const distanceModifier = buildDistanceModifierState(waypoint, tableKey);
      if (!distanceModifier) return context;
      context.gumDistanceModifier = distanceModifier;
      return context;
    }
  }

  config.Canvas.rulerClass = GumDistanceRuler;
  return true;
}
