import {
  CONTENT_SOURCE_PURPOSES,
  contentSourceService
} from "../services/content-source-service.mjs";

export class ContentSourceConfig extends FormApplication {
  constructor(...args) {
    super(...args);
    this.selectedByPurpose = new Map();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "gum-content-source-config",
      title: "GUM.ContentSources.Title",
      template: "systems/gum/templates/apps/content-source-config.hbs",
      classes: ["gum", "content-source-config"],
      width: 650,
      height: "auto",
      closeOnSubmit: true
    });
  }

  async getData() {
    const context = await super.getData();
    const itemPacks = game.packs
      .filter(pack => (pack.documentName || pack.metadata?.type) === "Item")
      .map(pack => ({ id: pack.collection, label: pack.title || pack.metadata?.label || pack.collection }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));

    context.purposes = Object.values(CONTENT_SOURCE_PURPOSES).map(definition => {
      if (!this.selectedByPurpose.has(definition.id)) {
        this.selectedByPurpose.set(definition.id, contentSourceService.getSourceIds(definition.id));
      }
      return this.#preparePurpose(definition, itemPacks);
    });
    context.itemPacks = itemPacks;
    return context;
  }

  #preparePurpose(definition, itemPacks) {
    const labels = new Map(itemPacks.map(pack => [pack.id, pack.label]));
    const selectedIds = this.selectedByPurpose.get(definition.id) || [];
    return {
      ...definition,
      label: game.i18n.localize(definition.label),
      description: game.i18n.localize(definition.description),
      sourceIdsJson: JSON.stringify(selectedIds),
      sources: selectedIds.map((id, index) => ({
        id,
        order: index + 1,
        label: labels.get(id) || id,
        missing: !labels.has(id),
        canMoveUp: index > 0,
        canMoveDown: index < selectedIds.length - 1
      }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action='add-source']").on("click", event => this.#addSource(event));
    html.find("[data-action='remove-source']").on("click", event => this.#changeSource(event, "remove"));
    html.find("[data-action='move-source-up']").on("click", event => this.#changeSource(event, "up"));
    html.find("[data-action='move-source-down']").on("click", event => this.#changeSource(event, "down"));
    html.find("[data-action='restore-defaults']").on("click", event => this.#restoreDefaults(event));
  }

  #addSource(event) {
    event.preventDefault();
    const section = event.currentTarget.closest("[data-purpose]");
    const purpose = section.dataset.purpose;
    const id = section.querySelector("select[name='available-source']")?.value;
    if (!id) return;
    const selected = this.selectedByPurpose.get(purpose) || [];
    if (!selected.includes(id)) selected.push(id);
    this.selectedByPurpose.set(purpose, selected);
    this.render();
  }

  #changeSource(event, action) {
    event.preventDefault();
    const section = event.currentTarget.closest("[data-purpose]");
    const purpose = section.dataset.purpose;
    const id = event.currentTarget.closest("[data-source-id]").dataset.sourceId;
    const selected = [...(this.selectedByPurpose.get(purpose) || [])];
    const index = selected.indexOf(id);
    if (index < 0) return;
    if (action === "remove") selected.splice(index, 1);
    if (action === "up" && index > 0) [selected[index - 1], selected[index]] = [selected[index], selected[index - 1]];
    if (action === "down" && index < selected.length - 1) [selected[index + 1], selected[index]] = [selected[index], selected[index + 1]];
    this.selectedByPurpose.set(purpose, selected);
    this.render();
  }

  #restoreDefaults(event) {
    event.preventDefault();
    const purpose = event.currentTarget.closest("[data-purpose]").dataset.purpose;
    this.selectedByPurpose.set(purpose, [...CONTENT_SOURCE_PURPOSES[purpose].defaults]);
    this.render();
  }

  async _updateObject(_event, formData) {
    for (const purpose of Object.keys(CONTENT_SOURCE_PURPOSES)) {
      const raw = formData[`${purpose}Sources`] || "[]";
      let ids = [];
      try {
        ids = JSON.parse(raw);
      } catch (_error) {
        return ui.notifications.error(game.i18n.format("GUM.ContentSources.Errors.SavePurpose", {
          purpose: game.i18n.localize(CONTENT_SOURCE_PURPOSES[purpose].label)
        }));
      }
      await contentSourceService.setSourceIds(purpose, ids);
    }
    ui.notifications.info(game.i18n.localize("GUM.ContentSources.Notifications.Saved"));
  }
}
