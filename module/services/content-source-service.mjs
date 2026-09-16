export const CONTENT_SOURCE_SETTING = "contentSources";

export const CONTENT_SOURCE_PURPOSES = Object.freeze({
  effects: Object.freeze({
    id: "effects",
    label: "Efeitos",
    description: "Bibliotecas usadas pelo navegador e pelos seletores de efeitos.",
    defaults: Object.freeze(["gum.efeitos"]),
    documentName: "Item",
    itemTypes: Object.freeze(["effect"])
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
  constructor(foundryGame = globalThis.game) {
    this.game = foundryGame;
  }

  getDefinition(purpose) {
    const definition = CONTENT_SOURCE_PURPOSES[purpose];
    if (!definition) throw new Error(`Finalidade de fonte desconhecida: ${purpose}`);
    return definition;
  }

  getSettings() {
    return normalizeContentSourceSettings(this.game.settings.get("gum", CONTENT_SOURCE_SETTING));
  }

  getSourceIds(purpose) {
    return getConfiguredSourceIds(this.getSettings(), purpose);
  }

  async setSourceIds(purpose, ids) {
    this.getDefinition(purpose);
    const settings = this.getSettings();
    settings[purpose] = uniqueStrings(ids);
    await this.game.settings.set("gum", CONTENT_SOURCE_SETTING, settings);
  }

  async restoreDefaults(purpose) {
    const definition = this.getDefinition(purpose);
    await this.setSourceIds(purpose, definition.defaults);
  }

  resolveSources(purpose) {
    const definition = this.getDefinition(purpose);
    return this.getSourceIds(purpose).map(id => {
      const pack = this.game.packs.get(id);
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
