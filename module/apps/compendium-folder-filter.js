export const UNFILED_FOLDER_ID = "__unfiled__";

const getParentId = folder => folder?.folder?.id ?? folder?.folder ?? folder?._source?.folder ?? null;

/**
 * Adds each record's complete folder ancestry and returns a tree-ordered filter list.
 * A folder matches its own records and every record in any descendant folder.
 */
export function prepareCompendiumFolderFilters(records, folders = []) {
  const folderById = new Map((folders ?? []).map(folder => [folder.id, {
    id: folder.id,
    name: folder.name,
    parentId: getParentId(folder)
  }]));
  const usedFolderIds = new Set();
  let hasUnfiled = false;

  for (const record of records) {
    const trail = [];
    const visited = new Set();
    let folderId = record.folderId;

    if (!folderId) {
      record.folderTrail = [UNFILED_FOLDER_ID];
      hasUnfiled = true;
      continue;
    }

    while (folderId && !visited.has(folderId)) {
      visited.add(folderId);
      const folder = folderById.get(folderId);
      if (!folder) break;
      trail.unshift(folder.id);
      usedFolderIds.add(folder.id);
      folderId = folder.parentId;
    }
    record.folderTrail = trail;
  }

  const childrenByParent = new Map();
  for (const folderId of usedFolderIds) {
    const folder = folderById.get(folderId);
    if (!folder) continue;
    const parentId = usedFolderIds.has(folder.parentId) ? folder.parentId : null;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(folder);
    childrenByParent.set(parentId, children);
  }

  const result = [];
  const appendChildren = (parentId, depth) => {
    const children = childrenByParent.get(parentId) ?? [];
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of children) {
      result.push({ id: folder.id, name: folder.name, depth });
      appendChildren(folder.id, depth + 1);
    }
  };
  appendChildren(null, 0);

  if (hasUnfiled) result.unshift({ id: UNFILED_FOLDER_ID, name: "Sem pasta", depth: 0, isUnfiled: true });
  return result;
}

export function recordMatchesFolderFilter(record, selectedFolderIds) {
  if (!selectedFolderIds?.size) return true;
  return (record.folderTrail ?? []).some(folderId => selectedFolderIds.has(folderId));
}