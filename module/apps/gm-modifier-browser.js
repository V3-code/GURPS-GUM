import { GumPreviewDialog } from "./preview-dialog.js";
import { GM_MODIFIER_CATEGORY_OPTIONS, normalizeGMModifierCategory } from "../utils/gm-modifier-categories.js";
// GUM/module/apps/gm-modifier-browser.js

const getLocalizedCategoryLabel = (categoryId) => game.i18n.localize(`GUM.GMModifierBrowser.Categories.${categoryId}`);

export class GMModifierBrowser extends FormApplication {
  
  constructor(options = {}) {
    super({}, options);
    this.onSelect = options.onSelect; 
    this.allModifiers = [];
    this.availableFolders = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("GUM.GMModifierBrowser.Title"),
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
    
    // Busca no compêndio correto
    let pack = game.packs.get("gum.gm_modifiers") || 
               game.packs.get("world.modificadores-basicos") ||
               game.packs.find(p => p.metadata.label === "[GUM] Modificadores de Rolagem" || p.metadata.label === "[GUM] Modificadores Básicos");
    
    if (pack) {
        const folderMap = new Map();
        for (const folder of pack.folders ?? []) {
            folderMap.set(folder.id, folder.name);
        }

        const content = await pack.getDocuments();
        this.allModifiers = content.map(item => {
            const formattedVal = (item.system.modifier > 0 ? '+' : '') + item.system.modifier;
                        const category = normalizeGMModifierCategory(item.system.ui_category || "situation");
            const categoryLabel = getLocalizedCategoryLabel(category);
            const displayGroup = String(item.system.group || "").trim() || categoryLabel;
            const subtitleParts = [
                game.i18n.format("GUM.GMModifierBrowser.ModifierSubtitle", { value: formattedVal }),
                game.i18n.format("GUM.GMModifierBrowser.CategorySubtitle", { value: categoryLabel })
            ];
            if (displayGroup && displayGroup !== categoryLabel) {
                subtitleParts.push(game.i18n.format("GUM.GMModifierBrowser.GroupSubtitle", { value: displayGroup }));
            }
            if (item.system.nh_cap) {
                subtitleParts.push(game.i18n.format("GUM.GMModifierBrowser.CapSubtitle", { value: item.system.nh_cap }));
            }

            return {
                id: item.id,
                uuid: item.uuid,
                name: item.name,
                system: item.system,
                img: item.img,
                displayImg: item.img !== "icons/svg/mystery-man.svg" ? item.img : null,
                // Prepara dados para filtros
                                category,
                categoryLabel,
                displayGroup,
                folderId: item.folder?.id ?? item.folder ?? item._source?.folder ?? null,
                isBonus: item.system.modifier >= 0,
                formattedVal,
                modifierSubtitle: subtitleParts.join(" • ")
            };
        });
        this.allModifiers.sort((a, b) => a.name.localeCompare(b.name));

        const usedFolderIds = new Set(this.allModifiers.map(mod => mod.folderId).filter(Boolean));
        this.availableFolders = Array.from(usedFolderIds)
          .map(folderId => ({ id: folderId, name: folderMap.get(folderId) ?? game.i18n.localize("GUM.GMModifierBrowser.FolderFallback") }))
          .sort((a, b) => a.name.localeCompare(b.name));
    }
    
    context.modifiers = this.allModifiers;
    context.folders = this.availableFolders;
    const usedCategories = new Set(this.allModifiers.map(mod => mod.category));
    context.categories = GM_MODIFIER_CATEGORY_OPTIONS
        .filter(category => usedCategories.has(category.id))
        .map(category => ({ ...category, label: getLocalizedCategoryLabel(category.id) }));
    
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
            const itemId = li.data('id');
            const itemData = this.allModifiers.find(m => m.id === itemId);

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
            type: game.i18n.localize("GUM.GMModifierBrowser.ModifierType"),
            img: itemData.img || "icons/svg/d20.svg",
            description: await GumPreviewDialog.enrichDescription(s.description || `<i>${game.i18n.localize("GUM.GMModifierBrowser.NoDescription")}</i>`),
            tags: [
                { label: game.i18n.localize("GUM.GMModifierBrowser.Value"), value: itemData.formattedVal },
                { label: game.i18n.localize("GUM.GMModifierBrowser.Cap"), value: s.nh_cap },
                { label: game.i18n.localize("GUM.GMModifierBrowser.Duration"), value: s.duration }
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
        
        const modId = li.dataset.id; // Vamos colocar data-id no LI
        const modCategory = li.dataset.category;
        const modVal = parseFloat(li.dataset.val);
        const modSearch = (li.dataset.search || li.querySelector('.item-name').innerText).toLowerCase();
        const modFolderId = li.dataset.folderId || null;

        let isVisible = true;

        // 1. Texto
        if (searchQuery && !modSearch.includes(searchQuery)) isVisible = false;

        // 2. Valor (Bônus/Penalidade)
        if (isVisible) {
            if (modVal >= 0 && !showBonus) isVisible = false;
            if (modVal < 0 && !showPenalty) isVisible = false;
        }

        // 3. Pasta
        if (isVisible && hasFolderFilter && !selectedFolders.has(modFolderId)) isVisible = false;

        // 4. Categoria
        if (isVisible && filterCategories) {
            if (!activeCategories.includes(modCategory)) isVisible = false;
        }

        li.style.display = isVisible ? "grid" : "none";
    }
  }

  async _updateObject(event, formData) {
    // Filtra apenas as chaves que são IDs (tamanho 16) e estão true
    const selectedIds = Object.keys(formData).filter(key => formData[key] === true && key.length === 16);
    
    if (selectedIds.length === 0) return ui.notifications.warn(game.i18n.localize("GUM.GMModifierBrowser.NoSelection"));
    
    const selectedItems = selectedIds.map(id => this.allModifiers.find(m => m.id === id)).filter(m => m);

    if (this.onSelect) {
        this.onSelect(selectedItems);
    }
  }
}