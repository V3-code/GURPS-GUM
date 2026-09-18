import { GumPreviewDialog } from "./preview-dialog.js";
import { recordMatchesFolderFilter } from "./compendium-folder-filter.js";
import { contentSourceService } from "../services/content-source-service.mjs";
import { loadContentSourceBrowserData } from "../utils/content-source-browser.mjs";
export class TemplateBrowser extends FormApplication {
  constructor(actor, options = {}) {
    super({}, options);
    this.actor = actor;
    this.onSelect = options.onSelect;
    this.allTemplates = [];
    this.availableFolders = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Navegador de Modelos",
      classes: ["gum", "template-browser", "theme-dark"],
      template: "systems/gum/templates/apps/template-browser.hbs",
      width: 900,
      height: 700,
      resizable: true
    });
  }

  async getData() {
    const context = await super.getData();
    const { records, folders, invalidSources } = await loadContentSourceBrowserData({
      purpose: "templates",
      selectionPrefix: "templateSelection",
      service: contentSourceService
    });
    this.allTemplates = records;
    this.availableFolders = folders;

    context.templates = this.allTemplates;
    context.folders = this.availableFolders;
    context.invalidSources = invalidSources;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".browser-sidebar input").on("keyup change", this._onFilterResults.bind(this));
    html.find('input[name="search"]').on("keydown", event => {
      if (event.key === "Enter") event.preventDefault();
    });

    html.find(".result-item").on("click", ev => {
      if ($(ev.target).closest("input, button").length) return;
      const radio = $(ev.currentTarget).find('input[type="radio"]');
      radio.prop("checked", true).trigger("change");
    });

    html.find('.results-list input[type="radio"]').on("change", ev => {
      html.find(".result-item").removeClass("selected");
      const li = $(ev.currentTarget).closest(".result-item");
      li.addClass("selected");
    });

    html.find(".browser-quick-view").on("click", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const li = $(ev.currentTarget).closest(".result-item");
      const selectionKey = li.attr("data-selection-key");
      const template = this.allTemplates.find(t => t.selectionKey === selectionKey);
      if (template) await this._showQuickView(template);
    });
  }

  _onFilterResults() {
    const form = this.form;
    const resultsList = form.querySelector(".results-list");
    const searchQuery = form.querySelector('[name="search"]').value.toLowerCase();

    const selectedFolders = new Set(
      Array.from(form.querySelectorAll('[name="filter-folder"]:checked')).map(input => input.value)
    );
    const hasFolderFilter = selectedFolders.size > 0;

    for (const li of resultsList.children) {
      if (li.classList.contains("placeholder-text")) continue;

      const selectionKey = li.querySelector('input[type="radio"]').value;
      const template = this.allTemplates.find(t => t.selectionKey === selectionKey);
      if (!template) continue;

      let isVisible = true;

      if (searchQuery && !template.name.toLowerCase().includes(searchQuery)) {
        isVisible = false;
      }

      if (isVisible && hasFolderFilter) {
        if (!recordMatchesFolderFilter(template, selectedFolders)) isVisible = false;
      }

      li.style.display = isVisible ? "grid" : "none";
    }
  }

  async _showQuickView(templateData) {
    const template = templateData?.uuid ? (await fromUuid(templateData.uuid).catch(() => null)) || templateData : templateData;
    const system = template?.system || {};
    const blocks = system.blocks || [];
    return GumPreviewDialog.show({
      title: template?.name || "Modelo",
      type: "Modelo",
      img: template?.img || "icons/svg/book.svg",
      description: await GumPreviewDialog.enrichDescription(system.description || "<i>Modelo de personagem.</i>"),
      tags: [
        { label: "Categoria", value: system.model_category || "generic" },
        { label: "Blocos", value: blocks.length },
        { label: "Origem", value: templateData.sourceLabel || "-" },
        { label: "Pasta", value: templateData.folderLabel || "Sem pasta" }
      ],
      width: 500
    });

    const content = `
      <div class="gurps-dialog-canvas">
        <div class="gurps-item-preview-card">
          <header class="preview-header">
            <h3>${template?.name || "Modelo"}</h3>
            <div class="header-controls"><span class="preview-item-type">Modelo</span></div>
          </header>
          <div class="preview-content">
            <div class="preview-properties">
              <div class="property-tag"><label>Categoria</label><span>${system.model_category || "generic"}</span></div>
              <div class="property-tag"><label>Blocos</label><span>${blocks.length}</span></div>
              <div class="property-tag"><label>Origem</label><span>${templateData.sourceLabel || "-"}</span></div>
              <div class="property-tag"><label>Pasta</label><span>${templateData.folderLabel || "Sem pasta"}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    new Dialog({
      title: `Detalhes: ${template?.name || "Modelo"}`,
      content,
      buttons: { close: { label: "Fechar" } },
      default: "close",
      options: { classes: ["dialog", "gurps-item-preview-dialog"], width: 420 }
    }).render(true);
  }

  async _updateObject(_event, formData) {
    const selectedId = formData.selectedTemplate;
    if (!selectedId) return ui.notifications.warn("Nenhum Modelo foi selecionado.");

    const selectedTemplate = this.allTemplates.find(entry => entry.selectionKey === selectedId);
    if (!selectedTemplate) return ui.notifications.error("Modelo selecionado não encontrado.");

    if (this.onSelect) {
      this.onSelect(selectedTemplate);
    }
  }

}
