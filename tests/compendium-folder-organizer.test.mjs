import assert from "node:assert/strict";
import test from "node:test";
import { organizeGumCompendia } from "../module/utils/compendium-folder-organizer.mjs";

const collection = values => {
  const result = [...values];
  result.filter = Array.prototype.filter.bind(result);
  result.find = Array.prototype.find.bind(result);
  result.some = Array.prototype.some.bind(result);
  return result;
};

test("moves every GUM system pack into one root folder and removes empty legacy folders", async () => {
  const configured = [];
  const deleted = [];
  const legacyRoot = { id: "old-root", name: "[GUM] SISTEMA", type: "Compendium", folder: null, delete: async function () { this.deleted = true; deleted.push(this.id); } };
  const legacyChild = { id: "old-child", name: "[GUM] Modificadores", type: "Compendium", folder: "old-root", delete: async function () { this.deleted = true; deleted.push(this.id); } };
  const gumPack = {
    collection: "gum.skills",
    metadata: { packageType: "system", packageName: "gum" },
    folder: "old-child",
    configure: async function (data) { this.folder = data.folder; configured.push(this.collection); }
  };
  const modulePack = {
    collection: "module.extra",
    metadata: { packageType: "module", packageName: "extra" },
    folder: null,
    configure: async () => assert.fail("module packs must not be moved")
  };
  const game = { packs: collection([gumPack, modulePack]), folders: collection([legacyRoot, legacyChild]) };
  const FolderClass = {
    create: async data => {
      const folder = { id: "gum-root", ...data, update: async () => undefined, delete: async () => undefined };
      game.folders.push(folder);
      return folder;
    }
  };

  const folder = await organizeGumCompendia(game, FolderClass);

  assert.equal(folder.name, "GUM");
  assert.equal(gumPack.folder, "gum-root");
  assert.deepEqual(configured, ["gum.skills"]);
  assert.deepEqual(deleted, ["old-child", "old-root"]);
});
