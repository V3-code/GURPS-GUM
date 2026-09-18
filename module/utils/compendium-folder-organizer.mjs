const LEGACY_GUM_FOLDER_NAMES = new Set([
  "[GUM] SISTEMA",
  "[GUM] CENÁRIO",
  "[GUM] Condições e Efeitos",
  "[GUM] Modificadores"
]);

const folderParentId = folder => folder?.folder?.id ?? folder?.folder ?? null;
const packFolderId = pack => pack?.folder?.id ?? pack?.folder ?? null;

export function getGumSystemPacks(game) {
  return game.packs.filter(pack =>
    pack.metadata?.packageType === "system"
    && pack.metadata?.packageName === "gum"
  );
}

export async function organizeGumCompendia(game, FolderClass) {
  const folders = game.folders?.filter(folder => folder.type === "Compendium") ?? [];
  let gumFolder = folders.find(folder => folder.name === "GUM" && folderParentId(folder) === null);

  if (!gumFolder) {
    gumFolder = await FolderClass.create({
      name: "GUM",
      type: "Compendium",
      color: "#3f464d",
      folder: null
    });
  } else if (gumFolder.color !== "#3f464d") {
    await gumFolder.update({ color: "#3f464d" });
  }

  for (const pack of getGumSystemPacks(game)) {
    if (packFolderId(pack) === gumFolder.id) continue;
    try {
      await pack.configure({ folder: gumFolder.id });
    } catch (error) {
      console.warn(`GUM | Não foi possível mover o compêndio "${pack.collection}" para a pasta "GUM".`, error);
    }
  }

  const legacyFolders = folders.filter(folder => LEGACY_GUM_FOLDER_NAMES.has(folder.name));
  const deletedFolderIds = new Set();
  for (let pass = 0; pass < legacyFolders.length; pass += 1) {
    for (const folder of [...legacyFolders].reverse()) {
      if (!folder?.id || deletedFolderIds.has(folder.id)) continue;
      const hasPack = game.packs.some(pack => packFolderId(pack) === folder.id);
      const hasChild = game.folders.some(child =>
        child.id !== folder.id
        && folderParentId(child) === folder.id
        && !deletedFolderIds.has(child.id)
      );
      if (!hasPack && !hasChild) {
        await folder.delete();
        deletedFolderIds.add(folder.id);
      }
    }
  }

  return gumFolder;
}
