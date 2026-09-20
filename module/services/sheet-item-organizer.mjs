export const ORGANIZER_DRAG_TYPE = "GUM.ItemOrganizer";
const ORGANIZER_MIME = "application/x-gum-item-organizer";

export function readOrganizerDragData(dataTransfer) {
  if (!dataTransfer) return null;
  for (const mime of [ORGANIZER_MIME, "text/plain"]) {
    const raw = dataTransfer.getData(mime);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      if (data?.type === ORGANIZER_DRAG_TYPE) return data;
    } catch (_error) {
      // A carga pode pertencer ao Foundry ou a outro módulo.
    }
  }
  return null;
}

function getTargetIndex(zone, event, itemSelector, draggedItemId) {
  const item = event.target.closest(itemSelector);
  if (item?.dataset.organizerItemId === draggedItemId) return null;
  if (!item || !zone.contains(item)) {
    return zone.querySelectorAll(itemSelector).length;
  }
  const items = [...zone.querySelectorAll(itemSelector)].filter(entry => entry.dataset.organizerItemId !== draggedItemId);
  const itemIndex = items.indexOf(item);
  if (itemIndex < 0) return items.length;
  const bounds = item.getBoundingClientRect();
  const after = event.clientY > bounds.top + bounds.height / 2;
  return itemIndex + (after ? 1 : 0);
}

export function attachSheetItemOrganizer(root, {
  actorUuid,
  namespace,
  acceptedItemTypes = [],
  itemSelector = "[data-organizer-item-id]",
  zoneSelector = "[data-organizer-zone]",
  onMove
}) {
  if (!root || !namespace || typeof onMove !== "function") return () => {};
  let activeZone = null;

  const clearTarget = () => {
    activeZone?.classList.remove("is-organizer-drop-target");
    activeZone = null;
  };

  const onDragStart = event => {
    const item = event.target.closest(itemSelector);
    if (!item || !root.contains(item) || !event.dataTransfer) return;
    const itemId = item.dataset.organizerItemId;
    const itemType = item.dataset.organizerItemType;
    if (!itemId || (acceptedItemTypes.length && !acceptedItemTypes.includes(itemType))) return;
    const payload = JSON.stringify({ type: ORGANIZER_DRAG_TYPE, actorUuid, namespace, itemId, itemType });
    event.dataTransfer.setData(ORGANIZER_MIME, payload);
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.effectAllowed = "move";
    item.classList.add("is-organizer-dragging");
  };

  const onDragEnd = event => {
    event.target.closest(itemSelector)?.classList.remove("is-organizer-dragging");
    clearTarget();
  };

  const accepts = event => {
    const data = readOrganizerDragData(event.dataTransfer);
    return data
      && data.actorUuid === actorUuid
      && data.namespace === namespace
      && (!acceptedItemTypes.length || acceptedItemTypes.includes(data.itemType));
  };

  const onDragOver = event => {
    const zone = event.target.closest(zoneSelector);
    if (!zone || !root.contains(zone) || !accepts(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (activeZone !== zone) {
      clearTarget();
      activeZone = zone;
      zone.classList.add("is-organizer-drop-target");
    }
  };

  const onDrop = async event => {
    const zone = event.target.closest(zoneSelector);
    const data = readOrganizerDragData(event.dataTransfer);
    if (!zone || !data || !accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const targetGroupId = zone.dataset.organizerGroupId || "";
    const targetIndex = getTargetIndex(zone, event, itemSelector, data.itemId);
    clearTarget();
    if (targetIndex === null) return;
    await onMove({ ...data, targetGroupId, targetIndex });
  };

  // A captura garante que o organizador trate seu payload antes do drop genérico do Foundry.
  root.addEventListener("dragstart", onDragStart, true);
  root.addEventListener("dragend", onDragEnd, true);
  root.addEventListener("dragover", onDragOver, true);
  root.addEventListener("drop", onDrop, true);
  return () => {
    root.removeEventListener("dragstart", onDragStart, true);
    root.removeEventListener("dragend", onDragEnd, true);
    root.removeEventListener("dragover", onDragOver, true);
    root.removeEventListener("drop", onDrop, true);
  };
}
