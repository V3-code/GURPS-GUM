export const EQUIPMENT_LOCATION_ZONES = Object.freeze(["equipped", "carried", "stored"]);

export function resolveEquipmentDrop(item, targetZone, { container = null } = {}) {
  if (!item || !targetZone) return null;

  if (targetZone.startsWith("container:")) {
    if (!container || container.id === item.id || item.system?.is_container) return null;
    const location = container.system?.stored
      ? "stored"
      : container.system?.equipped
        ? "equipped"
        : "carried";

    return {
      _id: item.id,
      "system.parent_container_id": container.id,
      "system.location": location,
      "system.equipped": location === "equipped",
      "system.stored": location === "stored"
    };
  }

  if (!EQUIPMENT_LOCATION_ZONES.includes(targetZone)) return null;
  return {
    _id: item.id,
    "system.parent_container_id": "",
    "system.location": targetZone,
    "system.equipped": targetZone === "equipped",
    "system.stored": targetZone === "stored"
  };
}
