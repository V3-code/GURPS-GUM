import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompendiumLibraryExport,
  parseCompendiumLibraryExport,
  sortCompendiumFoldersParentFirst
} from "../module/utils/compendium-library-json.mjs";

const document = value => ({ toObject: () => ({ ...value }) });

test("exports documents together with nested and empty compendium folders", () => {
  const pack = {
    metadata: { type: "Item" },
    folders: [
      document({ _id: "parent", name: "Parent", folder: null }),
      document({ _id: "child", name: "Empty child", folder: "parent" })
    ]
  };
  const exported = buildCompendiumLibraryExport(pack, [document({ _id: "item", folder: "parent" })]);

  assert.equal(exported.format, "gum-compendium-library");
  assert.equal(exported.version, 1);
  assert.deepEqual(exported.folders.map(folder => folder._id), ["parent", "child"]);
  assert.equal(exported.documents[0].folder, "parent");
  assert.deepEqual(parseCompendiumLibraryExport(exported).folders, exported.folders);
});

test("orders child folders after their parents", () => {
  const folders = [
    { _id: "grandchild", folder: "child" },
    { _id: "child", folder: "parent" },
    { _id: "parent", folder: null }
  ];
  assert.deepEqual(sortCompendiumFoldersParentFirst(folders).map(folder => folder._id), ["parent", "child", "grandchild"]);
});

test("does not claim legacy array exports", () => {
  assert.equal(parseCompendiumLibraryExport([{ _id: "item" }]), null);
});

test("rejects folders without ids instead of silently omitting them", () => {
  assert.throws(
    () => sortCompendiumFoldersParentFirst([{ _id: "valid", folder: null }, { name: "Broken" }]),
    /folder at index 1 is missing "_id"/
  );
});
