export const GUM_COMPENDIUM_LIBRARY_FORMAT = "gum-compendium-library";
export const GUM_COMPENDIUM_LIBRARY_VERSION = 1;

/** Build the portable JSON representation of a compendium, including empty folders. */
export function buildCompendiumLibraryExport(pack, documents) {
  return {
    format: GUM_COMPENDIUM_LIBRARY_FORMAT,
    version: GUM_COMPENDIUM_LIBRARY_VERSION,
    documentType: pack?.metadata?.type || pack?.documentName || "Item",
    folders: Array.from(pack?.folders ?? [], folder => folder.toObject()),
    documents: Array.from(documents ?? [], document => document.toObject())
  };
}

/** Return a normalized portable export, or null when data uses another JSON format. */
export function parseCompendiumLibraryExport(data) {
  if (!data || data.format !== GUM_COMPENDIUM_LIBRARY_FORMAT) return null;
  if (data.version !== GUM_COMPENDIUM_LIBRARY_VERSION) {
    throw new Error(`Unsupported GUM compendium library version: ${data.version}.`);
  }
  if (!Array.isArray(data.documents) || !Array.isArray(data.folders)) {
    throw new Error("Invalid GUM compendium library: folders and documents must be arrays.");
  }
  return {
    documentType: data.documentType || "Item",
    folders: data.folders,
    documents: data.documents
  };
}

export function getCompendiumFolderParentId(folder) {
  return folder?.folder?.id ?? folder?.folder ?? null;
}

/** Sort parents before children, while safely handling malformed cyclic references. */
export function sortCompendiumFoldersParentFirst(folders) {
  const normalizedFolders = folders ?? [];
  const invalidFolderIndex = normalizedFolders.findIndex(folder => !folder?._id);
  if (invalidFolderIndex >= 0) {
    throw new Error(`Invalid GUM compendium library: folder at index ${invalidFolderIndex} is missing "_id".`);
  }

  const seenIds = new Set();
  const duplicateId = normalizedFolders.find(folder => {
    if (seenIds.has(folder._id)) return true;
    seenIds.add(folder._id);
    return false;
  })?._id;
  if (duplicateId) {
    throw new Error(`Invalid GUM compendium library: duplicate folder ID "${duplicateId}".`);
  }

  const pending = new Map(normalizedFolders.map(folder => [folder._id, folder]));
  const sorted = [];
  const completed = new Set();

  while (pending.size) {
    let progressed = false;
    for (const [id, folder] of pending) {
      const parentId = getCompendiumFolderParentId(folder);
      if (parentId && pending.has(parentId) && !completed.has(parentId)) continue;
      sorted.push(folder);
      completed.add(id);
      pending.delete(id);
      progressed = true;
    }
    if (progressed) continue;

    // A valid Foundry tree cannot be cyclic. Keep malformed entries importable at the root.
    for (const folder of pending.values()) sorted.push({ ...folder, folder: null });
    break;
  }

  return sorted;
}
