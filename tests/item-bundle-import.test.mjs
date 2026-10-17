import test from "node:test";
import assert from "node:assert/strict";
import { stableBundleDocumentId } from "../module/utils/item-bundle-json.mjs";

globalThis.Hooks = { on() {} };
const { synchronizeItemBundle } = await import("../module/apps/importers.js");

const bundle = () => ({
  format: "gum-item-bundle",
  version: 1,
  id: "bundle-import-test",
  root: "equipment",
  documents: {
    effect: { name: "Glow", type: "effect", system: { schemaVersion: 2, actions: [] } },
    equipment: {
      name: "Lamp",
      type: "equipment",
      system: { passiveEffects: { glow: { effectRef: "effect" } } }
    }
  }
});

function setupRuntime({ failRoot = false, failItemDelete = false } = {}) {
  const documents = new Map();
  const folders = new Map();
  const calls = [];
  const notifications = [];
  const pack = {
    collection: "world.bundle-test",
    title: "Bundle Test",
    locked: true,
    metadata: { type: "Item" },
    get folders() { return Array.from(folders.values()); },
    async configure({ locked }) { this.locked = locked; calls.push(["lock", locked]); },
    async getDocuments() { return Array.from(documents.values()); }
  };

  const wrap = source => {
    const data = structuredClone(source);
    return {
      ...data,
      id: data._id,
      toObject: () => structuredClone(data)
    };
  };
  const wrapFolder = source => {
    const data = structuredClone(source);
    return {
      ...data,
      id: data._id,
      toObject: () => structuredClone(data)
    };
  };

  globalThis.game = {
    i18n: {
      localize: key => key,
      format: (key, values) => `${key}:${JSON.stringify(values)}`
    }
  };
  globalThis.ui = {
    notifications: {
      info: message => notifications.push(["info", message]),
      error: message => notifications.push(["error", message])
    }
  };
  globalThis.Item = {
    async createDocuments(entries) {
      const entry = entries[0];
      calls.push(["create", entry.type, entry._id]);
      if (failRoot && entry.type === "equipment") throw new Error("root failed");
      documents.set(entry._id, wrap(entry));
    },
    async updateDocuments(entries) {
      for (const entry of entries) {
        calls.push(["update", entry.type, entry._id]);
        documents.set(entry._id, wrap(entry));
      }
    },
    async deleteDocuments(ids) {
      calls.push(["delete", ...ids]);
      if (failItemDelete) throw new Error("item rollback failed");
      for (const id of ids) documents.delete(id);
    }
  };
  globalThis.Folder = {
    async createDocuments(entries) {
      const entry = entries[0];
      calls.push(["folder-create", entry.name, entry._id]);
      folders.set(entry._id, wrapFolder(entry));
    },
    async updateDocuments(entries) {
      for (const entry of entries) {
        calls.push(["folder-update", entry.name, entry._id]);
        folders.set(entry._id, wrapFolder(entry));
      }
    },
    async deleteDocuments(ids) {
      calls.push(["folder-delete", ...ids]);
      for (const id of ids) folders.delete(id);
    }
  };

  return { pack, documents, folders, calls, notifications };
}

test("imports dependencies before the root, resolves UUIDs, and safely reimports", async () => {
  const runtime = setupRuntime();
  const first = await synchronizeItemBundle(runtime.pack, bundle());

  assert.equal(first.created, 2);
  assert.equal(first.updated, 0);
  assert.equal(runtime.folders.size, 3);
  assert.deepEqual(runtime.calls.filter(call => call[0] === "create").map(call => call[1]), ["effect", "equipment"]);
  assert.deepEqual(runtime.calls.filter(call => call[0] === "lock"), [["lock", false], ["lock", true]]);
  const equipment = Array.from(runtime.documents.values()).find(document => document.type === "equipment");
  const effect = Array.from(runtime.documents.values()).find(document => document.type === "effect");
  assert.equal(equipment.system.passiveEffects.glow.effectUuid, first.documents.find(entry => entry.key === "effect").uuid);
  assert.notEqual(equipment.folder, effect.folder);

  const manualFolderId = "manual-folder";
  runtime.folders.set(manualFolderId, {
    id: manualFolderId,
    name: "Manual",
    type: "Item",
    flags: {},
    toObject: () => ({ _id: manualFolderId, name: "Manual", type: "Item", flags: {} })
  });
  equipment.folder = manualFolderId;
  const managedFolder = Array.from(runtime.folders.values()).find(folder => folder.flags?.gum?.itemBundle?.key === "folder:bundle");
  managedFolder.name = "My custom bundle folder";

  runtime.calls.length = 0;
  const second = await synchronizeItemBundle(runtime.pack, bundle());
  assert.equal(second.created, 0);
  assert.equal(second.updated, 2);
  assert.deepEqual(runtime.calls.filter(call => call[0] === "update").map(call => call[1]), ["effect", "equipment"]);
  assert.equal(Array.from(runtime.documents.values()).find(document => document.type === "equipment").folder, manualFolderId);
  assert.equal(runtime.calls.some(call => call[0] === "folder-update"), false);
  assert.equal(runtime.folders.get(managedFolder.id).name, "My custom bundle folder");
});

test("repairs a stale item folder reference on reimport", async () => {
  const runtime = setupRuntime();
  await synchronizeItemBundle(runtime.pack, bundle());
  const equipment = Array.from(runtime.documents.values()).find(document => document.type === "equipment");
  equipment.folder = "missing-folder";

  await synchronizeItemBundle(runtime.pack, bundle());

  const updated = Array.from(runtime.documents.values()).find(document => document.type === "equipment");
  assert.notEqual(updated.folder, "missing-folder");
  assert.equal(runtime.folders.has(updated.folder), true);
});

test("refuses deterministic folder collisions before unlocking the pack", async () => {
  const runtime = setupRuntime();
  const folderId = stableBundleDocumentId(bundle().id, "folder:bundle");
  runtime.folders.set(folderId, {
    id: folderId,
    name: "Unrelated folder",
    flags: {},
    toObject: () => ({ _id: folderId, name: "Unrelated folder", flags: {} })
  });

  const result = await synchronizeItemBundle(runtime.pack, bundle());

  assert.equal(result, null);
  assert.deepEqual(runtime.calls.filter(call => call[0] === "lock"), []);
  assert.equal(runtime.documents.size, 0);
  assert.equal(runtime.folders.get(folderId).name, "Unrelated folder");
});

test("rolls back dependencies when root creation fails", async () => {
  const runtime = setupRuntime({ failRoot: true });
  const result = await synchronizeItemBundle(runtime.pack, bundle());

  assert.equal(result, null);
  assert.equal(runtime.documents.size, 0);
  assert.equal(runtime.folders.size, 0);
  assert.equal(runtime.calls.some(call => call[0] === "delete"), true);
  assert.equal(runtime.pack.locked, true);
  assert.equal(runtime.notifications.some(([type]) => type === "error"), true);
});

test("continues later rollback stages after an earlier rollback failure", async () => {
  const runtime = setupRuntime({ failRoot: true, failItemDelete: true });
  const result = await synchronizeItemBundle(runtime.pack, bundle());

  assert.equal(result, null);
  assert.equal(runtime.calls.some(call => call[0] === "delete"), true);
  assert.equal(runtime.calls.some(call => call[0] === "folder-delete"), true);
  assert.equal(runtime.folders.size, 0);
  assert.equal(runtime.notifications.some(([, message]) => message === "GUM.LibraryImport.BundleRollbackFailed"), true);
  assert.equal(runtime.pack.locked, true);
});
