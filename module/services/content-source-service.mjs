export const CONTENT_SOURCE_SETTING = "contentSources";

export const CONTENT_SOURCE_PURPOSES = Object.freeze({
  conditions: Object.freeze({
    id: "conditions",
    label: "Condições",
    description: "Bibliotecas usadas pelo navegador e pelos seletores de condições.",
    defaults: Object.freeze(["gum.conditions"]),
    documentName: "Item",
    itemTypes: Object.freeze(["condition"])
  }),
  modifiers: Object.freeze({
    id: "modifiers",
    label: "Ampliações e Limitações",
    description: "Bibliotecas usadas na edição de vantagens, desvantagens e poderes.",
    defaults: Object.freeze(["gum.modifiers"]),
    documentName: "Item",
    itemTypes: Object.freeze(["modifier"])
  }),
  equipmentModifiers: Object.freeze({
    id: "equipmentModifiers",
    label: "Modificadores de Equipamento",
    description: "Bibliotecas usadas na edição de equipamentos.",
    defaults: Object.freeze(["gum.eqp_modifiers"]),
    documentName: "Item",
    itemTypes: Object.freeze(["eqp_modifier"])
  }),
  effects: Object.freeze({
    id: "effects",
    label: "Efeitos",
    description: "Bibliotecas usadas pelo navegador e pelos seletores de efeitos.",
    defaults: Object.freeze(["gum.efeitos"]),
    documentName: "Item",
    itemTypes: Object.freeze(["effect"])
  }),
  triggers: Object.freeze({
    id: "triggers",
    label: "Gatilhos",
    description: "Bibliotecas usadas pelos editores de condições e efeitos.",
    defaults: Object.freeze(["gum.gatilhos"]),
    documentName: "Item",
    itemTypes: Object.freeze(["trigger"])
  })
});

const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : [])
  .map(value => String(value ?? "").trim())
  .filter(Boolean))];

export function normalizeContentSourceSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([purpose, ids]) => [purpose, uniqueStrings(ids)]));
}

export function getConfiguredSourceIds(settings, purpose) {
  const definition = CONTENT_SOURCE_PURPOSES[purpose];
  if (!definition) throw new Error(`Finalidade de fonte desconhecida: ${purpose}`);
  const normalized = normalizeContentSourceSettings(settings);
  return Object.hasOwn(normalized, purpose) ? normalized[purpose] : [...definition.defaults];
}

export function getDocumentIdentity(document) {
  return document?.getFlag?.("core", "sourceId")
    || document?.flags?.core?.sourceId
    || document?.uuid
    || `${document?.type || "Document"}:${document?.id || document?._id || ""}`;
}

export function deduplicateSourceDocuments(documents) {
  const seen = new Set();
  return (documents ?? []).filter(document => {
    const identity = getDocumentIdentity(document);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export class ContentSourceService {
  constructor(foundryGame) {
    this.injectedGame = foundryGame;
  }

  get game() {
    return this.injectedGame ?? globalThis.game;
  }

  requireGame({ settings = false, packs = false } = {}) {
    const foundryGame = this.game;
    if (!foundryGame) {
      throw new Error("O Serviço de Fontes de Conteúdo foi chamado antes da inicialização do Foundry (game indisponível).");
    }
    if (settings && (!foundryGame.settings || typeof foundryGame.settings.get !== "function")) {
      throw new Error("O Serviço de Fontes de Conteúdo foi chamado antes da inicialização das configurações do Foundry (game.settings indisponível).");
    }
    if (packs && (!foundryGame.packs || typeof foundryGame.packs.get !== "function")) {
      throw new Error("O Serviço de Fontes de Conteúdo foi chamado antes da inicialização dos compêndios do Foundry (game.packs indisponível).");
    }
    return foundryGame;
  }

  getDefinition(purpose) {
    const definition = CONTENT_SOURCE_PURPOSES[purpose];
    if (!definition) throw new Error(`Finalidade de fonte desconhecida: ${purpose}`);
    return definition;
  }

  getSettings() {
    const foundryGame = this.requireGame({ settings: true });
    return normalizeContentSourceSettings(foundryGame.settings.get("gum", CONTENT_SOURCE_SETTING));
  }

  getSourceIds(purpose) {
    return getConfiguredSourceIds(this.getSettings(), purpose);
  }

  async setSourceIds(purpose, ids) {
    this.getDefinition(purpose);
    const foundryGame = this.requireGame({ settings: true });
    if (typeof foundryGame.settings.set !== "function") {
      throw new Error("Não foi possível salvar as fontes de conteúdo: game.settings.set indisponível.");
    }
    const settings = this.getSettings();
    settings[purpose] = uniqueStrings(ids);
    await foundryGame.settings.set("gum", CONTENT_SOURCE_SETTING, settings);
  }

  async restoreDefaults(purpose) {
    const definition = this.getDefinition(purpose);
    await this.setSourceIds(purpose, definition.defaults);
  }

  resolveSources(purpose) {
    const definition = this.getDefinition(purpose);
    const foundryGame = this.requireGame({ settings: true, packs: true });
    return this.getSourceIds(purpose).map(id => {
      const pack = foundryGame.packs.get(id);
      const documentName = pack?.documentName || pack?.metadata?.type;
      const valid = Boolean(pack) && documentName === definition.documentName;
      return {
        id,
        pack: valid ? pack : null,
        status: !pack ? "missing" : valid ? "available" : "incompatible"
      };
    });
  }

  async getDocuments(purpose) {
    const definition = this.getDefinition(purpose);
    const documents = [];
    const invalidSources = [];

    for (const source of this.resolveSources(purpose)) {
      if (!source.pack) {
        invalidSources.push({ id: source.id, status: source.status });
        continue;
      }
      try {
        const sourceDocuments = await source.pack.getDocuments();
        documents.push(...sourceDocuments.filter(document =>
          !definition.itemTypes?.length || definition.itemTypes.includes(document.type)
        ));
      } catch (error) {
        invalidSources.push({ id: source.id, status: "unreadable", error });
      }
    }

    return { documents: deduplicateSourceDocuments(documents), invalidSources };
  }
}

export const contentSourceService = new ContentSourceService();
