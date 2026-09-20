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

export function buildEquipmentSortUpdates(items, {
  itemId,
  targetZone,
  targetIndex = 0
} = {}) {
  const equipment = Array.from(items || []);
  const movedItem = equipment.find(item => item.id === itemId);
  if (!movedItem || movedItem.system?.is_container) return [];

  const containerId = String(targetZone || "").startsWith("container:")
    ? String(targetZone).slice("container:".length)
    : "";
  const inTargetBucket = item => {
    if (item.system?.is_container) return false;
    if (containerId) return (item.system?.parent_container_id || "") === containerId;
    return !item.system?.parent_container_id && (
      (targetZone === "equipped" && item.system?.equipped) ||
      (targetZone === "stored" && item.system?.stored) ||
      (targetZone === "carried" && !item.system?.equipped && !item.system?.stored)
    );
  };

  const ordered = equipment
    .filter(item => item.id !== itemId && inTargetBucket(item))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const insertionIndex = Math.max(0, Math.min(Number(targetIndex) || 0, ordered.length));
  ordered.splice(insertionIndex, 0, movedItem);

  return ordered.map((item, index) => ({ _id: item.id, sort: (index + 1) * 100000 }));
}
