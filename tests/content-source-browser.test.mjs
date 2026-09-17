import assert from "node:assert/strict";
import test from "node:test";
import { loadContentSourceBrowserData } from "../module/utils/content-source-browser.mjs";

test("prepares namespaced folders and collision-free selection keys across sources", async () => {
  const documents = [
    {
      id: "same-id",
      uuid: "Compendium.gum.conditions.Item.same-id",
      pack: "gum.conditions",
      name: "Zeta",
      type: "condition",
      system: {},
      img: "icons/svg/mystery-man.svg",
      folder: { id: "shared-folder" }
    },
    {
      id: "same-id",
      uuid: "Compendium.world.conditions.Item.same-id",
      pack: "world.conditions",
      name: "Alfa",
      type: "condition",
      system: {},
      img: "icons/custom.webp",
      folder: { id: "shared-folder" }
    }
  ];
  const service = {
    getDocuments: async () => ({ documents, invalidSources: [{ id: "missing.conditions", status: "missing" }] }),
    resolveSources: () => [
      { id: "gum.conditions", pack: { title: "[GUM] Condições", folders: [{ id: "shared-folder", name: "Básicas" }] } },
      { id: "world.conditions", pack: { title: "Condições da Campanha", folders: [{ id: "shared-folder", name: "Campanha" }] } }
    ]
  };

  const result = await loadContentSourceBrowserData({
    purpose: "conditions",
    selectionPrefix: "conditionSelection",
    service
  });

  assert.deepEqual(result.records.map(record => ({
    name: record.name,
    selectionKey: record.selectionKey,
    folderId: record.folderId,
    displayImg: record.displayImg
  })), [
    {
      name: "Alfa",
      selectionKey: "conditionSelection-1",
      folderId: "world.conditions:shared-folder",
      displayImg: "icons/custom.webp"
    },
    {
      name: "Zeta",
      selectionKey: "conditionSelection-0",
      folderId: "gum.conditions:shared-folder",
      displayImg: null
    }
  ]);
  assert.deepEqual(result.folders.map(folder => folder.id), [
    "gum.conditions:shared-folder",
    "world.conditions:shared-folder"
  ]);
  assert.deepEqual(result.invalidSources, [{ id: "missing.conditions", status: "missing" }]);
});
