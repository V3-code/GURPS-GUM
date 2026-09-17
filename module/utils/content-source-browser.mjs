import { prepareCompendiumFolderFilters } from "../apps/compendium-folder-filter.js";

function getDocumentSourceId(document) {
  return document?.pack
    || document?.compendium?.collection
    || document?._stats?.compendiumSource?.split(".").slice(1, 3).join(".")
    || "";
}

function prepareSourceFolders(sources) {
  const folders = [];
  const labels = new Map();
  for (const { id: sourceId, pack } of sources) {
    const folderById = new Map((pack.folders ?? []).map(folder => [folder.id, folder]));
    for (const folder of pack.folders ?? []) {
      const parentId = folder.folder?.id ?? folder.folder ?? folder._source?.folder ?? null;
      const names = [];
      const visited = new Set();
      let cursor = folder;
      while (cursor && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        names.unshift(cursor.name);
        const cursorParentId = cursor.folder?.id ?? cursor.folder ?? cursor._source?.folder ?? null;
        cursor = cursorParentId ? folderById.get(cursorParentId) : null;
      }
      labels.set(`${sourceId}:${folder.id}`, names.join(" / "));
      folders.push({
        id: `${sourceId}:${folder.id}`,
        name: `${pack.title} / ${folder.name}`,
        folder: parentId ? `${sourceId}:${parentId}` : null
      });
    }
  }
  return { folders, labels };
}

export async function loadContentSourceBrowserData({ purpose, selectionPrefix, service }) {
  const { documents, invalidSources } = await service.getDocuments(purpose);
  const sources = service.resolveSources(purpose).filter(source => source.pack);
  const { folders, labels: folderLabels } = prepareSourceFolders(sources);
  const sourceLabels = new Map(sources.map(source => [
    source.id,
    source.pack.title || source.pack.metadata?.label || source.id
  ]));
  const records = documents.map((document, index) => {
    const sourceId = getDocumentSourceId(document);
    const folderId = document.folder?.id ?? document.folder ?? document._source?.folder ?? null;
    return {
      id: document.id,
      selectionKey: `${selectionPrefix}-${index}`,
      uuid: document.uuid,
      name: document.name,
      system: document.system,
      img: document.img,
      sourceId,
      sourceLabel: sourceLabels.get(sourceId) || sourceId,
      folderId: folderId && sourceId ? `${sourceId}:${folderId}` : null,
      folderLabel: folderId && sourceId ? folderLabels.get(`${sourceId}:${folderId}`) || "" : "",
      displayImg: document.img !== "icons/svg/mystery-man.svg" ? document.img : null
    };
  });
  records.sort((a, b) => a.name.localeCompare(b.name));
  return {
    records,
    folders: prepareCompendiumFolderFilters(records, folders),
    invalidSources
  };
}
