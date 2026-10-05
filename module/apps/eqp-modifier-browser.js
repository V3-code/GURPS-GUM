import { GumPreviewDialog } from "./preview-dialog.js";
import { recordMatchesFolderFilter } from "./compendium-folder-filter.js";
import { contentSourceService } from "../services/content-source-service.mjs";
import { loadContentSourceBrowserData } from "../utils/content-source-browser.mjs";
// systems/gum/module/apps/eqp-modifier-browser.js

export class EqpModifierBrowser extends FormApplication {
  constructor(targetItem, options) {
    super(options);
    this.targetItem = targetItem;
    this.allModifiers = [];
    this.availableFolders = [];

    this.filters = {
        search: "",
        folderIds: [],
        cfMin: null,
        cfMax: null
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Modificadores de Equipamento",
      classes: ["gum", "eqp-modifier-browser", "theme-dark"],
      template: "systems/gum/templates/apps/eqp-modifier-browser.hbs",
      width: 900,
      height: 700,
      resizable: true,
      scrollY: [".browser-results"]
    });
  }

  async getData() {
    const context = await super.getData();

    const { records, folders, invalidSources } = await loadContentSourceBrowserData({
        purpose: "equipmentModifiers",
        selectionPrefix: "equipmentModifierSelection",
        service: contentSourceService
    });
    this.allModifiers = records.map(record => ({
        ...record,
        formattedCF: this._getCostDisplay(record.system),
        formattedWeight: record.system.weight_mod || "x1"
    }));
    this.availableFolders = folders;

    context.modifiers = this.allModifiers;
    context.filters = this.filters;
    context.folders = this.availableFolders;
    context.invalidSources = invalidSources;

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // 1. Filtro de Texto
    html.find('input[name="search"]').on('input', event => {
      this.filters.search = event.target.value.toLowerCase();
      this._applyFilters(html);
    });

    // 2. Filtro de Pasta
    html.find('input[name="filter-folder"]').on('change', () => {
      this.filters.folderIds = html.find('input[name="filter-folder"]:checked').map((_, el) => el.value).get();
      this._applyFilters(html);
    });

    // 4. Filtro de CF
html.find('input[name="cfMin"], input[name="cfMax"]').on('input', event => {
        const val = parseFloat(event.target.value);
        if (event.target.name === "cfMin") this.filters.cfMin = isNaN(val) ? null : val;
        if (event.target.name === "cfMax") this.filters.cfMax = isNaN(val) ? null : val;
        this._applyFilters(html);
    });

    // Seleção de Linha
    html.find('.result-item').on('click', event => {
      if ($(event.target).is('input[type="checkbox"]') || $(event.target).closest('button').length) return;
      const checkbox = $(event.currentTarget).find('input[type="checkbox"]');
      checkbox.prop('checked', !checkbox.prop('checked'));
      $(event.currentTarget).toggleClass('selected', checkbox.prop('checked'));
    });

    html.find('.results-list input[type="checkbox"]').on('change', event => {
        const li = $(event.currentTarget).closest('.result-item');
        li.toggleClass('selected', event.currentTarget.checked);
    });

    html.find('.browser-quick-view').on('click', async event => {
        event.preventDefault();
        event.stopPropagation();
        const li = $(event.currentTarget).closest('.result-item');
        const selectionKey = li.attr('data-selection-key');
        const modifier = this.allModifiers.find(m => m.selectionKey === selectionKey);
        if (modifier) await this._showQuickView(modifier);
    });

    this._applyFilters(html);
  }

  /**
   * Lógica "OU" para filtros múltiplos.
   */
  _applyFilters(html) {
    const items = html.find('.result-item');
   const { search, folderIds, cfMin, cfMax } = this.filters;

    items.each((i, el) => {
        const item = $(el);
        let isVisible = true;

        // A. Texto
        if (search) {
            const name = item.find('.item-name').text().toLowerCase();
            const group = (item.data('group') || "").toString().toLowerCase();
            if (!name.includes(search) && !group.includes(search)) isVisible = false;
        }

        // B. Pasta
        if (isVisible && folderIds.length > 0) {
            const selectionKey = item.attr("data-selection-key");
            if (!recordMatchesFolderFilter(this.allModifiers.find(mod => mod.selectionKey === selectionKey), new Set(folderIds))) isVisible = false;
        }

        // C. CF
        if (isVisible) {
            const cf = parseFloat(item.data('cf')) || 0;
            if (cfMin !== null && cf < cfMin) isVisible = false;
            if (cfMax !== null && cf > cfMax) isVisible = false;
        }

el.style.display = isVisible ? "grid" : "none";
    });
  }

  async _showQuickView(modifierData) {
      const modifier = modifierData?.uuid ? (await fromUuid(modifierData.uuid).catch(() => null)) || modifierData : modifierData;
      const system = modifier?.system || {};
      return GumPreviewDialog.show({
        title: modifier?.name || "Modificador",
        type: "Mod. Equipamento",
        img: modifier?.img || "icons/svg/upgrade.svg",
        description: await GumPreviewDialog.enrichDescription(system.description || "<i>Sem descrição.</i>"),
        tags: [
          { label: "Custo", value: this._getCostDisplay(system) },
          { label: "Peso", value: system.weight_mod },
          { label: "NT", value: system.tech_level },
          { label: "Grupo", value: system.group }
        ],
        width: 500
      });
  }

  _formatValue(val) {
      if (val === null || val === undefined) return "";
      const num = Number(val);
      if (isNaN(num)) return val;
      return (num > 0 ? "+" : "") + num;
  }

  _getCostDisplay(system = {}) {
      if (system.cost_adjustment && `${system.cost_adjustment}`.trim() !== "") {
          return `${system.cost_adjustment}`.trim();
      }

      const num = Number(system.cost_factor || 0);
      return `${num >= 0 ? "+" : ""}${num} CF`;
  }

  async _updateObject(event, formData) {
    const selectedIds = Object.keys(formData).filter(key => formData[key] === true && key.startsWith("equipmentModifierSelection-"));
    if (selectedIds.length === 0) return ui.notifications.warn("Nenhum modificador selecionado.");

    const newModifiersData = {};
    const cloneData = value => foundry.utils.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value));
    for (const id of selectedIds) {
      const sourceModifier = this.allModifiers.find(m => m.selectionKey === id);
      if (sourceModifier) {
        const newKey = foundry.utils.randomID();
        newModifiersData[`system.eqp_modifiers.${newKey}`] = {
          id: newKey,
          name: sourceModifier.name,
          cost_adjustment: sourceModifier.system.cost_adjustment,
          cost_factor: sourceModifier.system.cost_factor,
          weight_mod: sourceModifier.system.weight_mod,
          enabled: sourceModifier.system.enabled !== false,
          level: sourceModifier.system.level ?? 1,
          adjustment_schema: sourceModifier.system.adjustment_schema ?? 0,
          cost_adjustment_data: cloneData(sourceModifier.system.cost_adjustment_data || {}),
          weight_adjustment_data: cloneData(sourceModifier.system.weight_adjustment_data || {}),
          features_data: cloneData(sourceModifier.system.features_data || []),
          gcs_features_unmapped: cloneData(sourceModifier.system.gcs_features_unmapped || []),
          tech_level: sourceModifier.system.tech_level,
          group: sourceModifier.system.group,
          ref: sourceModifier.system.ref,
          source_uuid: sourceModifier.uuid
        };
      }
    }

    await this.targetItem.update(newModifiersData);
    ui.notifications.info(`${Object.keys(newModifiersData).length} modificadores adicionados.`);
  }
}
