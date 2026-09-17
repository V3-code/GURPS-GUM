import { GumPreviewDialog } from "./preview-dialog.js";
import { GM_MODIFIER_CATEGORY_OPTIONS, getGMModifierCategoryLabel, normalizeGMModifierCategory } from "../utils/gm-modifier-categories.js";
import { recordMatchesFolderFilter } from "./compendium-folder-filter.js";
import { contentSourceService } from "../services/content-source-service.mjs";
import { loadContentSourceBrowserData } from "../utils/content-source-browser.mjs";
// GUM/module/apps/gm-modifier-browser.js

export class GMModifierBrowser extends FormApplication {
  
  constructor(options = {}) {
    super({}, options);
    this.onSelect = options.onSelect; 
    this.allModifiers = [];
    this.availableFolders = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: "Navegador de Modificadores Globais",
      // Reutilizamos a classe CSS existente para manter o estilo
      classes: ["gum", "gm-modifier-browser", "theme-dark"], 
      template: "systems/gum/templates/apps/gm-modifier-browser.hbs",
      width: 900, 
      height: 700, 
      resizable: true
    });
  }

  async getData() {
    const context = await super.getData();
    
    const { records, folders, invalidSources } = await loadContentSourceBrowserData({
        purpose: "rollModifiers",
        selectionPrefix: "rollModifierSelection",
        service: contentSourceService
    });
    this.allModifiers = records.map(item => {
            const formattedVal = (item.system.modifier > 0 ? '+' : '') + item.system.modifier;
                        const category = normalizeGMModifierCategory(item.system.ui_category || "situation");
            const categoryLabel = getGMModifierCategoryLabel(category);
            const displayGroup = String(item.system.group || "").trim() || categoryLabel;
            const subtitleParts = [`Modificador: ${formattedVal}`, `Categoria: ${categoryLabel}`];
            if (displayGroup && displayGroup !== categoryLabel) subtitleParts.push(`Grupo: ${displayGroup}`);
            if (item.system.nh_cap) subtitleParts.push(`Teto ${item.system.nh_cap}`);

            return {
                ...item,
                // Prepara dados para filtros
                                category,
                categoryLabel,
                displayGroup,
                isBonus: item.system.modifier >= 0,
                formattedVal,
                modifierSubtitle: subtitleParts.join(" • ")
            };
        });
    this.availableFolders = folders;
    
    context.modifiers = this.allModifiers;
    context.folders = this.availableFolders;
    context.invalidSources = invalidSources;
    const usedCategories = new Set(this.allModifiers.map(mod => mod.category));
    context.categories = GM_MODIFIER_CATEGORY_OPTIONS.filter(category => usedCategories.has(category.id));
    
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Filtro de Texto e Checkboxes
    html.find('.browser-sidebar input').on('keyup change', this._onFilterResults.bind(this));
    
    // Previne envio com Enter na busca
    html.find('input[name="search"]').on('keydown', (event) => {
        if (event.key === 'Enter') event.preventDefault();
    });
    
 // Seleção de linha ao clicar (UX)
    html.find('.result-item').click(ev => {
        if ($(ev.target).is('input[type="checkbox"]') || $(ev.target).is('button') || $(ev.target).closest('button').length) return;
        const checkbox = $(ev.currentTarget).find('input[type="checkbox"]');
        checkbox.prop('checked', !checkbox.prop('checked'));
        $(ev.currentTarget).toggleClass('selected', checkbox.prop('checked'));
    });

    html.find('.results-list input[type="checkbox"]').on('change', ev => {
        const li = $(ev.currentTarget).closest('.result-item');
        li.toggleClass('selected', ev.currentTarget.checked);
    });

    html.find('.browser-quick-view').click(ev => {
            ev.preventDefault();
            ev.stopPropagation(); // Impede selecionar a linha

            const li = $(ev.currentTarget).closest('.result-item');
            const selectionKey = li.attr('data-selection-key');
            const itemData = this.allModifiers.find(m => m.selectionKey === selectionKey);

            if (itemData) {
                this._showQuickView(itemData);
            }
        });
  }

  /**
     * Método auxiliar para abrir o Dialog (cópia da lógica Universal)
     */
    async _showQuickView(itemData) {
        // Precisamos recuperar o objeto 'item' completo para ter acesso ao 'system'
        // Como allModifiers tem 'system', podemos usar direto.
        
        const s = itemData.system;
        return GumPreviewDialog.show({
            title: itemData.name,
            type: "Modificador GM",
            img: itemData.img || "icons/svg/d20.svg",
            description: await GumPreviewDialog.enrichDescription(s.description || "<i>Sem descrição.</i>"),
            tags: [
                { label: "Valor", value: itemData.formattedVal },
                { label: "Teto", value: s.nh_cap },
                { label: "Duração", value: s.duration }
            ],
            width: 500
        });
    }

  _onFilterResults(event) {
    const form = this.form;
    const resultsList = form.querySelector(".results-list");
    
    const searchQuery = form.querySelector('[name="search"]').value.toLowerCase();

    const selectedFolders = new Set(
      Array.from(form.querySelectorAll('[name="filter-folder"]:checked')).map(input => input.value)
    );
    const hasFolderFilter = selectedFolders.size > 0;
    
    // Lê filtros de Valor
    const showBonus = form.querySelector('[name="filter-bonus"]').checked;
    const showPenalty = form.querySelector('[name="filter-penalty"]').checked;

    // Lê filtros de Categoria (Cria um Set para busca rápida)
    const catCheckboxes = form.querySelectorAll('.category-filter input:checked');
    const activeCategories = Array.from(catCheckboxes).map(cb => cb.value);
    const filterCategories = activeCategories.length > 0; // Se 0, mostra tudo

    for (const li of resultsList.children) {
        if (li.classList.contains("placeholder-text")) continue;
        
        const selectionKey = li.dataset.selectionKey;
        const modCategory = li.dataset.category;
        const modVal = parseFloat(li.dataset.val);
        const modSearch = (li.dataset.search || li.querySelector('.item-name').innerText).toLowerCase();
        const modifier = this.allModifiers.find(mod => mod.selectionKey === selectionKey);

        let isVisible = true;

        // 1. Texto
        if (searchQuery && !modSearch.includes(searchQuery)) isVisible = false;

        // 2. Valor (Bônus/Penalidade)
        if (isVisible) {
            if (modVal >= 0 && !showBonus) isVisible = false;
            if (modVal < 0 && !showPenalty) isVisible = false;
        }

        // 3. Pasta
        if (isVisible && hasFolderFilter && !recordMatchesFolderFilter(modifier, selectedFolders)) isVisible = false;

        // 4. Categoria
        if (isVisible && filterCategories) {
            if (!activeCategories.includes(modCategory)) isVisible = false;
        }

        li.style.display = isVisible ? "grid" : "none";
    }
  }

  async _updateObject(event, formData) {
    const selectedIds = Object.keys(formData).filter(key => formData[key] === true && key.startsWith("rollModifierSelection-"));
    
    if (selectedIds.length === 0) return ui.notifications.warn("Nenhum modificador foi selecionado.");
    
    const selectedItems = selectedIds.map(id => this.allModifiers.find(m => m.selectionKey === id)).filter(m => m);

    if (this.onSelect) {
        this.onSelect(selectedItems);
    }
  }
}
