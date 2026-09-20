function documentId(document) {
  return document?.id || document?._id || "";
}

function cloneDocument(document) {
  return structuredClone(document?.toObject ? document.toObject() : document || {});
}

/**
 * Prepares selected GCS actor item changes without breaking container references.
 * New ancestors are automatically included when one of their descendants is selected.
 */
export function prepareGCSActorItemChanges(plan, selection, { randomID }) {
  const selectedAdditionIndexes = new Set(selection.additions || []);
  const additionsByTemporaryId = new Map(
    plan.additions.map((item, index) => [documentId(item), { item, index }]).filter(([id]) => id)
  );

  for (const index of [...selectedAdditionIndexes]) {
    let parentId = plan.additions[index]?.system?.parent_container_id || "";
    const visited = new Set();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = additionsByTemporaryId.get(parentId);
      if (!parent) break;
      selectedAdditionIndexes.add(parent.index);
      parentId = parent.item?.system?.parent_container_id || "";
    }
  }

  const selectedAdditions = plan.additions
    .filter((_item, index) => selectedAdditionIndexes.has(index))
    .map(cloneDocument);
  const selectedUpdates = plan.updates
    .filter((_entry, index) => selection.updates.has(index));

  const idMap = new Map();
  for (const { existing, incoming } of [...plan.updates, ...plan.unchanged]) {
    const temporaryId = documentId(incoming);
    const existingId = documentId(existing);
    if (temporaryId && existingId) idMap.set(temporaryId, existingId);
  }
  for (const addition of selectedAdditions) {
    const temporaryId = documentId(addition);
    const finalId = randomID();
    if (temporaryId) idMap.set(temporaryId, finalId);
    addition._id = finalId;
  }

  const rewriteParent = item => {
    const parentId = item?.system?.parent_container_id || "";
    if (parentId) item.system.parent_container_id = idMap.get(parentId) || "";
    return item;
  };

  const additions = selectedAdditions.map(rewriteParent);
  const updates = selectedUpdates.map(({ existing, incoming }) => {
    const update = cloneDocument(incoming);
    update._id = documentId(existing);
    return rewriteParent(update);
  });
  const removals = plan.removals
    .filter((_entry, index) => selection.removals.has(index))
    .map(documentId)
    .filter(Boolean);

  return { additions, updates, removals };
}
