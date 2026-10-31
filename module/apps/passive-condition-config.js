import { ConditionBrowser } from "./condition-browser.js";
import { contentSourceService } from "../services/content-source-service.mjs";
import { buildConfigurationBundle, combineConfigurationImport, parseConfigurationBundle } from "../utils/configuration-bundle-json.mjs";
import { chooseConfigurationImportMode, importConfigurationBundle } from "./configuration-bundle-import.js";
import {
  PASSIVE_CONDITION_CONFIG_SETTING,
  buildPassiveConditionConfigEntry,
  buildPassiveConditionSyncOperations,
  normalizePassiveConditionConfiguration,
  resolvePassiveConditionConfiguration,
  summarizePassiveConditionSync
} from "../utils/passive-condition-sync.mjs";

const LEGACY_EXPORT_FORMAT = "gum-passive-condition-configuration";
const effectLinks = system => {
  const raw = system?.effects;
  return Array.isArray(raw) ? raw : Object.values(raw || {});
};

export class PassiveConditionConfig extends FormApplication {
  constructor(...args) {
    super(...args);
    this.configuration = null;
    this.seededFromSources = false;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "gum-passive-condition-config",
      title: "GUM.PassiveConditions.Title",
      template: "systems/gum/templates/apps/passive-condition-config.hbs",
      classes: ["gum", "passive-condition-config", "theme-dark"],
      width: 980,
      height: 720,
      resizable: true,
      closeOnSubmit: false,
      scrollY: [".passive-condition-list"]
    });
  }

  async _loadConfiguration() {
    const stored = normalizePassiveConditionConfiguration(game.settings.get("gum", PASSIVE_CONDITION_CONFIG_SETTING));
    if (stored.initialized) {
      this.configuration = stored;
      return;
    }
    const { documents, invalidSources } = await contentSourceService.getDocuments("passiveConditions");
    this.configuration = normalizePassiveConditionConfiguration({ initialized: true, entries: documents.filter(document => document.system?.bindingMode !== "status-link").map(document => buildPassiveConditionConfigEntry(document)) });
    this.seededFromSources = this.configuration.entries.length > 0;
    if (invalidSources.length) console.warn("GUM | Fontes de Condições Passivas indisponíveis ao preparar a configuração:", invalidSources);
  }

  async getData() {
    const context = await super.getData();
    if (!this.configuration) await this._loadConfiguration();
    const rows = await Promise.all(this.configuration.entries.map(async (entry, index) => {
      const source = entry.sourceUuid ? await fromUuid(entry.sourceUuid).catch(() => null) : null;
      const links = effectLinks(entry.snapshot?.system);
      const effects = await Promise.all(links.map(async link => {
        const uuid = String(link?.effectUuid || link?.uuid || "").trim();
        const document = uuid ? await fromUuid(uuid).catch(() => null) : null;
        return { uuid: uuid || link?.effectRef || "", name: document?.name || link?.name || link?.effectRef || game.i18n.localize("GUM.PassiveConditions.MissingEffect"), img: document?.img || link?.img || "icons/svg/hazard.svg", missing: !document && Boolean(uuid || link?.effectRef) };
      }));
      return { ...entry, index, displayIndex: index + 1, sourceMissing: Boolean(entry.sourceUuid && !source), effects, effectCount: links.length, canMoveUp: index > 0, canMoveDown: index < this.configuration.entries.length - 1 };
    }));
    return { ...context, rows, seededFromSources: this.seededFromSources, empty: rows.length === 0 };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='browse']").on("click", event => this._browse(event));
    html.find("[data-action='remove']").on("click", event => this._remove(event));
    html.find("[data-action='move-up']").on("click", event => this._move(event, -1));
    html.find("[data-action='move-down']").on("click", event => this._move(event, 1));
    html.find("[data-action='open']").on("click", event => this._open(event));
    html.find("[data-action='sync']").on("click", event => this._previewAndSynchronize(event));
    html.find("[data-action='import']").on("click", event => this._import(event));
    html.find("[data-action='export']").on("click", event => this._export(event));
    html.find("[data-action='cancel']").on("click", event => { event.preventDefault(); this.close(); });
    html.find("[name='passive-search']").on("input", event => this._filter(event));
    html.on("dragover", ".passive-condition-dropzone", event => event.preventDefault());
    html.on("drop", ".passive-condition-dropzone", event => this._onDrop(event));
  }

  _syncFromForm() {
    if (!this.form) return;
    for (const row of this.form.querySelectorAll("[data-entry-id]")) {
      const entry = this.configuration.entries.find(candidate => candidate.id === row.dataset.entryId);
      if (entry) entry.enabled = row.querySelector("[data-field='enabled']")?.checked !== false;
    }
  }

  async _addDocuments(documents) {
    this._syncFromForm();
    for (const candidate of documents) {
      const document = candidate?.uuid ? await fromUuid(candidate.uuid).catch(() => null) : candidate;
      if (!document || document.type !== "condition" || document.system?.bindingMode === "status-link") continue;
      const entry = buildPassiveConditionConfigEntry(document);
      const existing = this.configuration.entries.find(row => row.sourceUuid && row.sourceUuid === entry.sourceUuid);
      if (existing) Object.assign(existing, entry, { id: existing.id });
      else this.configuration.entries.push(entry);
      if (entry.sourceUuid && !this.configuration.managedSourceUuids.includes(entry.sourceUuid)) this.configuration.managedSourceUuids.push(entry.sourceUuid);
    }
    this.render();
  }

  _browse(event) {
    event.preventDefault();
    new ConditionBrowser(null, { purpose: "passiveConditions", onSelect: selected => this._addDocuments(selected) }).render(true);
  }

  async _onDrop(event) {
    event.preventDefault();
    const data = TextEditor.getDragEventData(event.originalEvent || event);
    if (data.type !== "Item" || !data.uuid) return;
    const item = await fromUuid(data.uuid).catch(() => null);
    if (item?.type !== "condition") return ui.notifications.warn(game.i18n.localize("GUM.PassiveConditions.DropConditionOnly"));
    await this._addDocuments([item]);
  }

  _entryFromEvent(event) {
    return this.configuration.entries.find(entry => entry.id === event.currentTarget.closest("[data-entry-id]")?.dataset.entryId);
  }

  _remove(event) {
    event.preventDefault();
    this._syncFromForm();
    const entry = this._entryFromEvent(event);
    if (!entry) return;
    this.configuration.entries = this.configuration.entries.filter(candidate => candidate.id !== entry.id);
    this.render();
  }

  _move(event, direction) {
    event.preventDefault();
    this._syncFromForm();
    const entry = this._entryFromEvent(event);
    const index = this.configuration.entries.indexOf(entry);
    const target = index + direction;
    if (!entry || target < 0 || target >= this.configuration.entries.length) return;
    [this.configuration.entries[index], this.configuration.entries[target]] = [this.configuration.entries[target], this.configuration.entries[index]];
    this.render();
  }

  async _open(event) {
    event.preventDefault();
    const entry = this._entryFromEvent(event);
    const document = entry?.sourceUuid ? await fromUuid(entry.sourceUuid).catch(() => null) : null;
    if (document?.sheet) document.sheet.render(true);
    else ui.notifications.warn(game.i18n.localize("GUM.PassiveConditions.SourceUnavailable"));
  }

  _filter(event) {
    const query = String(event.currentTarget.value || "").trim().toLocaleLowerCase(game.i18n.lang);
    for (const row of this.form.querySelectorAll("[data-entry-id]")) row.hidden = query && !String(row.dataset.searchText || "").toLocaleLowerCase(game.i18n.lang).includes(query);
  }

  async _save() {
    this._syncFromForm();
    this.configuration.initialized = true;
    this.configuration = normalizePassiveConditionConfiguration(this.configuration);
    await game.settings.set("gum", PASSIVE_CONDITION_CONFIG_SETTING, this.configuration);
    this.seededFromSources = false;
  }

  async _previewAndSynchronize(event) {
    event.preventDefault();
    await this._save();
    const { resolved, missing } = await resolvePassiveConditionConfiguration(this.configuration);
    const actors = game.actors.filter(actor => actor.type === "character");
    const options = { removeMissing: true, managedSourceUuids: this.configuration.managedSourceUuids };
    const summary = summarizePassiveConditionSync(actors, resolved, options);
    const confirmed = await Dialog.confirm({ title: game.i18n.localize("GUM.PassiveConditions.SyncPreviewTitle"), content: `<div class="passive-condition-sync-preview"><p>${game.i18n.format("GUM.PassiveConditions.SyncPreview", summary)}</p>${missing.length ? `<p class="warning">${game.i18n.format("GUM.PassiveConditions.MissingEntries", { count: missing.length })}</p>` : ""}<p>${game.i18n.localize("GUM.PassiveConditions.ManualPreserved")}</p></div>`, yes: () => true, no: () => false, defaultYes: false });
    if (!confirmed) return;
    for (const actor of actors) {
      const plan = buildPassiveConditionSyncOperations(actor.items, resolved, options);
      if (plan.updates.length) await actor.updateEmbeddedDocuments("Item", plan.updates);
      if (plan.creates.length) await actor.createEmbeddedDocuments("Item", plan.creates);
      if (plan.deletes.length) await actor.deleteEmbeddedDocuments("Item", plan.deletes);
    }
    ui.notifications.info(game.i18n.format("GUM.PassiveConditions.SyncComplete", summary));
    this.render();
  }

  async _export(event) {
    event.preventDefault();
    this._syncFromForm();
    const payload = await buildConfigurationBundle({
      id: "gum-passive-conditions-world",
      name: game.i18n.localize("GUM.PassiveConditions.Title"),
      kind: "passive-conditions",
      configuration: normalizePassiveConditionConfiguration(this.configuration),
      resolveUuid: uuid => fromUuid(uuid).catch(() => null),
      systemVersion: game.system.version,
      foundryVersion: game.version
    });
    saveDataToFile(JSON.stringify(payload, null, 2), "application/json", "gum_condicoes_passivas.json");
    const unresolved = payload.portability?.unresolvedReferences?.length || 0;
    if (unresolved) ui.notifications.warn(game.i18n.format("GUM.PassiveConditions.ExportIncomplete", { count: unresolved }));
    else ui.notifications.info(game.i18n.localize("GUM.PassiveConditions.ExportComplete"));
  }

  _import(event) {
    event.preventDefault();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async change => {
      const file = change.target.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (payload?.format === LEGACY_EXPORT_FORMAT && payload?.version === 1) {
          const incoming = normalizePassiveConditionConfiguration({ ...payload.configuration, initialized: true });
          const mode = await chooseConfigurationImportMode("passive-conditions", this.configuration, incoming);
          if (!mode) return;
          this.configuration = normalizePassiveConditionConfiguration(combineConfigurationImport("passive-conditions", this.configuration, incoming, mode));
          await game.settings.set("gum", PASSIVE_CONDITION_CONFIG_SETTING, this.configuration);
        } else {
          const bundle = parseConfigurationBundle(payload);
          if (!bundle) throw new Error(game.i18n.localize("GUM.PassiveConditions.InvalidImport"));
          const result = await importConfigurationBundle(bundle, {
            expectedKind: "passive-conditions",
            getCurrentConfiguration: () => this.configuration,
            normalizeConfiguration: normalizePassiveConditionConfiguration,
            applyConfiguration: async configuration => {
              this.configuration = normalizePassiveConditionConfiguration(configuration);
              await game.settings.set("gum", PASSIVE_CONDITION_CONFIG_SETTING, this.configuration);
            }
          });
          if (!result) return;
        }
        this.render();
      } catch (error) {
        ui.notifications.error(error.message || game.i18n.localize("GUM.PassiveConditions.InvalidImport"));
      }
    };
    input.click();
  }

  async _updateObject(_event, _formData) {
    await this._save();
    ui.notifications.info(game.i18n.localize("GUM.PassiveConditions.Saved"));
    this.render();
  }
}
