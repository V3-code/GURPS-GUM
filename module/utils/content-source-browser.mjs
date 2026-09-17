import { prepareCompendiumFolderFilters } from "../apps/compendium-folder-filter.js";

function getDocumentSourceId(document) {
  return document?.pack
    || document?.compendium?.collection
    || document?._stats?.compendiumSource?.split(".").slice(1, 3).join(".")
    || "";
}

function prepareSourceFolders(sources) {
  const folders = [];
  for (const { id: sourceId, pack } of sources) {
    for (const folder of pack.folders ?? []) {
      const parentId = folder.folder?.id ?? folder.folder ?? folder._source?.folder ?? null;
      folders.push({
        id: `${sourceId}:${folder.id}`,
        name: `${pack.title} / ${folder.name}`,
        folder: parentId ? `${sourceId}:${parentId}` : null
      });
    }
  }
  return folders;
}

export async function loadContentSourceBrowserData({ purpose, selectionPrefix, service }) {
  const { documents, invalidSources } = await service.getDocuments(purpose);
  const sources = service.resolveSources(purpose).filter(source => source.pack);
  const folders = prepareSourceFolders(sources);
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
      folderId: folderId && sourceId ? `${sourceId}:${folderId}` : null,
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
