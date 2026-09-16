import assert from "node:assert/strict";
import test from "node:test";
import {
  ContentSourceService,
  deduplicateSourceDocuments,
  getConfiguredSourceIds,
  normalizeContentSourceSettings
} from "../module/services/content-source-service.mjs";

test("uses the GUM source by default but preserves an explicitly empty selection", () => {
  assert.deepEqual(getConfiguredSourceIds({}, "effects"), ["gum.efeitos"]);
  assert.deepEqual(getConfiguredSourceIds({ effects: [] }, "effects"), []);
});

test("normalizes source lists without changing their priority", () => {
  assert.deepEqual(normalizeContentSourceSettings({
    effects: [" world.effects ", "gum.efeitos", "world.effects", ""]
  }), { effects: ["world.effects", "gum.efeitos"] });
});

test("deduplicates copied documents by their original source UUID", () => {
  const documents = [
    { uuid: "Compendium.gum.efeitos.Item.a", flags: { core: { sourceId: "shared" } } },
    { uuid: "Compendium.world.effects.Item.b", flags: { core: { sourceId: "shared" } } },
    { uuid: "Compendium.world.effects.Item.c" }
  ];
  assert.deepEqual(deduplicateSourceDocuments(documents), [documents[0], documents[2]]);
});

test("loads valid effect documents in configured priority and reports missing sources", async () => {
  const officialEffect = { type: "effect", uuid: "Compendium.gum.efeitos.Item.a" };
  const campaignEffect = { type: "effect", uuid: "Compendium.world.effects.Item.b" };
  const wrongType = { type: "condition", uuid: "Compendium.world.effects.Item.c" };
  const packs = new Map([
    ["gum.efeitos", { documentName: "Item", getDocuments: async () => [officialEffect] }],
    ["world.effects", { documentName: "Item", getDocuments: async () => [campaignEffect, wrongType] }]
  ]);
  const foundryGame = {
    packs,
    settings: {
      get: () => ({ effects: ["world.effects", "missing.effects", "gum.efeitos"] }),
      set: async () => undefined
    }
  };

  const result = await new ContentSourceService(foundryGame).getDocuments("effects");
  assert.deepEqual(result.documents, [campaignEffect, officialEffect]);
  assert.deepEqual(result.invalidSources, [{ id: "missing.effects", status: "missing" }]);
});

test("rejects packs with an incompatible document type", () => {
  const service = new ContentSourceService({
    packs: new Map([["world.macros", { documentName: "Macro" }]]),
    settings: { get: () => ({ effects: ["world.macros"] }) }
  });
  assert.deepEqual(service.resolveSources("effects").map(({ id, status }) => ({ id, status })), [
    { id: "world.macros", status: "incompatible" }
  ]);
});

test("resolves the Foundry game lazily when it becomes available after construction", async () => {
  const previousGame = globalThis.game;
  delete globalThis.game;
  const service = new ContentSourceService();
  const effect = { type: "effect", uuid: "Compendium.world.late-effects.Item.a" };
  const pack = { documentName: "Item", getDocuments: async () => [effect] };

  try {
    globalThis.game = {
      packs: new Map([["world.late-effects", pack]]),
      settings: {
        get: () => ({ effects: ["world.late-effects"] }),
        set: async () => undefined
      }
    };

    assert.deepEqual(service.getSettings(), { effects: ["world.late-effects"] });
    assert.deepEqual(service.resolveSources("effects"), [{
      id: "world.late-effects",
      pack,
      status: "available"
    }]);
    assert.deepEqual(await service.getDocuments("effects"), {
      documents: [effect],
      invalidSources: []
    });
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});

test("reports an explicit error when Foundry is not initialized", () => {
  const previousGame = globalThis.game;
  delete globalThis.game;
  try {
    assert.throws(
      () => new ContentSourceService().getSettings(),
      /antes da inicialização do Foundry.*game indisponível/
    );
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});
