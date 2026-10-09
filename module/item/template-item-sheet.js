import { calculateTraitCost, traitCostInput } from "../utils/trait-cost.mjs";
import { templateEntryDisplayName } from "../utils/template-entry-display.mjs";
import { showTemplateEntryPreview } from "../apps/template-entry-preview.js";
const { ItemSheet } = foundry.appv1.sheets;
const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? foundry?.applications?.ux?.TextEditor ?? TextEditor;
const templateText = key => game.i18n.localize(`GUM.Template.${key}`);
const ATTRIBUTE_FIELDS = [
    ["st", "ST", 10], ["dx", "DX", 20], ["iq", "IQ", 20], ["ht", "HT", 10],
    ["will", "Vont", 5], ["per", "Per", 5], ["hp", "PV", 2], ["fp", "PF", 3],
    ["hp_max", "PV máx.", 2], ["fp_max", "PF máx.", 3],
    ["lifting_st", "ST levantamento", 3], ["vision", "Visão", 2], ["hearing", "Audição", 2],
    ["tastesmell", "Olfato/Paladar", 2], ["touch", "Tato", 2], ["mt", "MT", 0],
    ["basic_speed", "Velocidade", 5, 0.25], ["basic_move", "Deslocamento", 5],
    ["enhanced_move", "Deslocamento ampliado", 0], ["dodge", "Esquiva", 0]
];

export class TemplateItemSheet extends ItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["gum", "sheet", "item", "theme-dark", "template-item-sheet"],
            width: 700,
            height: 580,
            template: "systems/gum/templates/items/template-item-sheet.hbs",
            tabs: [{
                navSelector: ".sheet-tabs",
                contentSelector: ".sheet-body-content",
                initial: "structure"
            }],
            scrollY: [".sheet-body-content", ".template-structure-tab"],
            dragDrop: [{ dragSelector: null, dropSelector: ".template-dropzone" }]
        });
    }

    get title() {
        return this.item?.name ? `${templateText("Model")}: ${this.item.name}` : templateText("Model");
    }

    async getData(options = {}) {
        const context = await super.getData(options);
        context.system = this.item.system ?? {};
        context.enrichedDescription = await TextEditorImpl.enrichHTML(context.system.description || "", { async: true });
        context.enrichedChatDescription = await TextEditorImpl.enrichHTML(context.system.chat_description || "", { async: true });
        context.owner = context.owner ?? this.item.isOwner;
        context.editable = this.options.editable ?? this.isEditable;
        context.blocks = this._prepareBlocks(context.system.blocks ?? []);
        context.sharedBudgets = (Array.isArray(context.system.sharedBudgets) ? context.system.sharedBudgets : [])
            .map(budget => ({ ...budget, typeLabel: templateText(budget.type === "money" ? "Money" : "Points") }));
        return context;
    }

    _prepareBlocks(blocks) {
        return (blocks || []).map(block => {
            const typeLabel = this._getBlockTypeLabel(block.type);
            const displayTitle = (block.title || "").trim() || typeLabel;
            const contents = (block.contents || []).map(entry => this._prepareEntry(entry));
            const icon = this._getBlockIcon(block.type);
            const iconClass = {
                guaranteed: "fas fa-check-double",
                selection: "fas fa-list-ul",
                points: "fas fa-sliders-h",
                money: "fas fa-coins"
            }[block.type] || "fas fa-layer-group";

            return {
                ...block,
                displayTitle,
                typeLabel,
                isGuaranteed: block.type === "guaranteed",
                isSelection: block.type === "selection",
                isPoints: block.type === "points",
                isBudget: ["points", "money"].includes(block.type),
                isMoney: block.type === "money",
                budgetField: block.type === "money" ? "moneyAvailable" : "pointsAvailable",
                budgetValue: block.type === "money" ? (block.moneyAvailable ?? 0) : (block.pointsAvailable ?? 0),
                summaryText: this._buildBlockSummary(block, contents),
                icon,
                iconClass,
                contents
            };
        });
    }

    _prepareEntry(entry) {
        if (entry.kind === "template") {
            return {
                ...entry,
                rowName: entry.name || templateText("ReferencedModel"),
                rowQty: "-",
                rowLevel: "-",
                rowCost: entry.cost ?? 0,
                rowSubtitle: templateText("ReferencedModel")
            };
        }
        if (entry.kind === "group") {
            return {
                ...entry,
                rowName: entry.name || templateText("Subgroup"),
                rowQty: "-",
                rowLevel: "-",
                rowCost: entry.cost ?? 0,
                rowSubtitle: this._buildGroupSubtitle(entry)
            };
        }

        if (entry.kind === "attribute") {
            return {
                ...entry,
                rowName: entry.label || templateText("Attributes"),
                rowQty: "-",
                rowLevel: "-",
                rowCost: entry.cost ?? 0,
                rowSubtitle: this._buildAttributeSummary(entry)
            };
        }

        return {
            ...entry,
            rowName: templateEntryDisplayName(entry) || templateText("Item"),
            rowQty: entry.quantity ?? "-",
            rowLevel: entry.level ?? "-",
            rowCost: entry.itemType === "equipment"
                ? `${entry.cost ?? 0} $ / ${entry.pointsCost ?? 0} ${templateText("Points")}`
                : entry.cost ?? "-",
            rowSubtitle: this._buildItemSubtitle(entry)
        };
    }

    _buildBlockSummary(block, contents) {
        const count = contents.length;
        if (block.type === "selection") {
            return `${count} ${templateText("Items")} • ${block.choiceExact ? templateText("ChooseExactly") : templateText("ChooseUpTo")} ${block.choiceCount ?? 1}`;
        }
        if (block.type === "points") {
            return `${count} ${templateText("Options")} • ${block.pointsAvailable ?? 0} ${templateText("Points")}`;
        }
        if (block.type === "money") {
            return `${count} ${templateText("Options")} • ${block.moneyAvailable ?? 0} ${templateText("Money")}`;
        }
        return `${count} ${templateText("Items")}`;
    }

    _buildItemSubtitle(entry) {
        const parts = [];
        if (entry.itemType) parts.push(this._getItemTypeLabel(entry.itemType));
        if (entry.cost !== undefined && entry.cost !== null) parts.push(`${entry.cost} pts`);
        if (entry.level !== undefined && entry.level !== null && entry.level !== "") parts.push(`Nível ${entry.level}`);
        if (entry.quantity !== undefined && entry.quantity !== null && entry.quantity !== "" && entry.quantity !== 1) parts.push(`Qtd ${entry.quantity}`);
        return parts.join(" • ");
    }

    _buildGroupSubtitle(entry) {
        const parts = [templateText("Subgroup")];
        if (entry.localNotes) parts.push(String(entry.localNotes));
        const subBlocks = Array.isArray(entry.subBlocks) ? entry.subBlocks : [];
        parts.push(`${subBlocks.length} sub-bloco(s)`);
        return parts.join(" • ");
    }

    _buildAttributeSummary(entry) {
        const parts = this._getAttributeDisplayParts(entry);
        return parts.length ? parts.join(" • ") : templateText("NoChanges");
    }

    _getAttributeDisplayParts(entry) {
        const selected = new Set(Array.isArray(entry.selectedAttributes) ? entry.selectedAttributes : []);
        return Object.entries(entry.attributes || {}).flatMap(([key, raw]) => {
            const value = Number(raw) || 0;
            const configuredLimit = Number(entry.attributeLimits?.[key]);
            const hasLimit = Number.isFinite(configuredLimit) && configuredLimit > 0;
            if (!value && !hasLimit && !selected.has(key)) return [];
            const amount = `${value > 0 ? "+" : ""}${value}`;
            const limit = hasLimit ? ` (${templateText("AttributeMaxShort")} ${value < 0 ? "-" : "+"}${Math.max(Math.abs(value), configuredLimit)})` : "";
            return [`${this._getAttributeLabel(key)}: ${amount}${limit}`];
        });
    }

    _getItemTypeLabel(type) {
        const map = {
            skill: templateText("Skill"),
            spell: templateText("Spell"),
            power: templateText("Power"),
            advantage: templateText("Advantage"),
            disadvantage: templateText("Disadvantage"),
            equipment: templateText("Equipment")
        };
        return map[type] || type;
    }

    _getBlockTypeLabel(type) {
        const map = {
            guaranteed: templateText("Guaranteed"),
            selection: templateText("Selection"),
            points: templateText("PointAllocation"),
            money: templateText("MoneyAllocation")
        };
        return map[type] || templateText("Block");
    }

    _getBlockIcon(type) {
        const map = {
            guaranteed: "icons/sundries/misc/lock-open-yellow.webp",
            selection: "icons/sundries/misc/admission-ticket-grey.webp",
            points: "icons/sundries/books/book-open-purple.webp",
            money: "systems/gum/icons/svg/board.svg/coins.svg"
        };
        return map[type] || "icons/svg/item-bag.svg";
    }

    _getAttributeLabel(key) {
        const normalized = key === "move" ? "basic_move" : key;
        return ATTRIBUTE_FIELDS.some(field => field[0] === normalized) ? templateText(`AttributeLabel.${normalized}`) : key;
    }

    _getAttributeCostPerLevel(key) {
        return ATTRIBUTE_FIELDS.find(field => field[0] === key)?.[2] ?? (key === "move" ? 5 : 0);
    }

    _renderAttributeFieldRows(attributes = {}, costs = {}, limits = {}, selectedAttributes = undefined) {
        const hasExplicitSelection = Array.isArray(selectedAttributes);
        const selected = new Set(selectedAttributes || []);
        return ATTRIBUTE_FIELDS.map(([key, , defaultCost, step]) => {
            const value = attributes[key] ?? (key === "basic_move" ? attributes.move : undefined) ?? 0;
            const cost = costs[key] ?? (key === "basic_move" ? costs.move : undefined) ?? defaultCost;
            const limit = limits[key] ?? (key === "basic_move" ? limits.move : undefined) ?? "";
            const checked = hasExplicitSelection ? selected.has(key) : Boolean(Number(value) || Number(limit));
            return `
            <div class="template-attr-row">
                <label class="template-attr-selector" for="select-${key}" title="${templateText("SelectAttributeHint")}">
                    <input type="checkbox" id="select-${key}" class="template-attr-select" data-attribute="${key}" ${checked ? "checked" : ""}>
                    <span>${this._getAttributeLabel(key)}</span>
                </label>
                <input type="number" id="attr-${key}" value="${value}" step="${step || 1}">
                <input type="number" id="cost-${key}" value="${cost}">
                <input type="number" id="limit-${key}" value="${limit}" min="${step || 1}" step="${step || 1}" placeholder="∞" title="${templateText("AttributeLimitHint")}">
            </div>`;
        }).join("");
    }

    _readAttributeFields(html) {
        const attributes = {}, costs = {}, attributeLimits = {}, selectedAttributes = [];
        for (const [key] of ATTRIBUTE_FIELDS) {
            const value = Number(html.find(`#attr-${key}`).val()) || 0;
            const cost = Number(html.find(`#cost-${key}`).val()) || 0;
            const rawLimit = String(html.find(`#limit-${key}`).val() ?? "").trim();
            const limit = Number(rawLimit);
            const isSelected = html.find(`#select-${key}`).is(":checked") || value !== 0 || (rawLimit && Number.isFinite(limit) && limit > 0);
            if (!isSelected) continue;
            selectedAttributes.push(key);
            attributes[key] = value;
            costs[key] = cost;
            if (rawLimit && Number.isFinite(limit) && limit > 0) {
                attributeLimits[key] = Math.max(Math.abs(value), limit);
            }
        }
        return { attributes, costs, attributeLimits, selectedAttributes };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.on("click", ".preview-block-entry", this._onPreviewEntry.bind(this));
        if (!this.isEditable) return;

        html.on("click", ".toggle-editor", this._toggleEditor.bind(this));
        html.on("click", ".save-description", this._saveDescription.bind(this));
        html.on("click", ".cancel-description", this._cancelDescription.bind(this));

        html.on("click", ".add-template-block", this._onAddBlock.bind(this));
        html.on("click", ".toggle-template-block", this._onToggleBlock.bind(this));
        html.on("click", ".delete-template-block", this._onDeleteBlock.bind(this));
        html.on("change", ".block-field", this._onBlockFieldChange.bind(this));
        html.on("click", ".add-template-shared-budget", this._onAddSharedBudget.bind(this));
        html.on("click", ".delete-template-shared-budget", this._onDeleteSharedBudget.bind(this));
        html.on("change", ".template-shared-budget-field", this._onSharedBudgetFieldChange.bind(this));

        html.on("click", ".add-block-attribute", this._onAddAttribute.bind(this));
        html.on("click", ".add-block-group", this._onAddGroup.bind(this));
        html.on("click", ".delete-block-entry", this._onDeleteEntry.bind(this));
        html.on("click", ".edit-block-entry", this._onEditEntry.bind(this));

        html.on("dragover", ".template-dropzone", ev => ev.preventDefault());
 html.on("drop", ".template-dropzone", this._onDrop.bind(this));

    }

    _toggleEditor(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        const container = $(event.currentTarget).closest(".description-section");
        container.find(".description-view").toggle();
        container.find(".description-editor").toggle();
        if (field) {
            const editor = container.find(`.editor[data-edit="${field}"]`);
            if (editor.length) editor.trigger("focus");
        }
    }

    async _saveDescription(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        const container = $(event.currentTarget).closest(".description-section");
        const content = await this._getEditorContent(field, container);
        if (!field || content === null || content === undefined) return;

        await this.item.update({ [field]: content });
        const enriched = await TextEditorImpl.enrichHTML(content, { async: true });
        container.find(".description-view").html(enriched);
        container.find(".description-view").show();
        container.find(".description-editor").hide();
    }

    _cancelDescription(event) {
        event.preventDefault();
        const container = $(event.currentTarget).closest(".description-section");
        container.find(".description-view").show();
        container.find(".description-editor").hide();
    }

    _getEditorInstance(field) {
        const editor = this.editors?.[field];
        if (!editor) return null;
        return editor.editor ?? editor.instance ?? editor;
    }

    async _getEditorContent(field, container) {
        if (!field) return null;
        const instance = this._getEditorInstance(field);
        if (instance?.getHTML) {
            const html = instance.getHTML();
            return html?.then ? await html : html;
        }
        if (instance?.getContent) {
            const content = instance.getContent();
            return content?.then ? await content : content;
        }
        if (instance?.view?.dom?.innerHTML) return instance.view.dom.innerHTML;
        if (TextEditorImpl?.getContent) {
            const element = container.find(`[name="${field}"]`).get(0)
                ?? container.find(`.editor[data-edit="${field}"]`).get(0);
            if (element) return TextEditorImpl.getContent(element);
        }
        const namedInput = container.find(`[name="${field}"]`);
        if (namedInput.length) return namedInput.val();
        const editorElement = container.find(`.editor[data-edit="${field}"]`);
        if (editorElement.length) return editorElement.val() ?? editorElement.html();
        return "";
    }

    async _onAddBlock(event) {
        event.preventDefault();
        const config = await this._promptTemplateBlockConfiguration();
        if (!config) return;

        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        blocks.push({
            ...this._createTemplateBlock(config.type),
            title: config.title,
            selectionTarget: config.selectionTarget,
            collapsed: true
        });
        await this.item.update({ "system.blocks": blocks });
    }

    _promptTemplateBlockConfiguration() {
        const content = `
        <div class="template-block-create-dialog">
            <div class="form-group">
                <label>${templateText("BlockName")}</label>
                <input type="text" id="template-block-title" placeholder="${templateText("BlockNameHint")}"/>
            </div>

            <hr>

            <div class="template-block-type-list">
                <label class="template-block-type-option">
                    <input type="radio" name="template-block-type" value="guaranteed" checked>
                    <span>${templateText("AutomaticDelivery")}</span>
                </label>
                <label class="template-block-type-option">
                    <input type="radio" name="template-block-type" value="selection:items">
                    <span>${templateText("ChooseItems")}</span>
                </label>
                <label class="template-block-type-option">
                    <input type="radio" name="template-block-type" value="selection:packages">
                    <span>${templateText("ChoosePackages")}</span>
                </label>
                <label class="template-block-type-option">
                    <input type="radio" name="template-block-type" value="selection:templates">
                    <span>${templateText("ChooseModels")}</span>
                </label>
                <label class="template-block-type-option">
                    <input type="radio" name="template-block-type" value="points">
                    <span>${templateText("PointAllocation")}</span>
                </label>
                <label class="template-block-type-option">
                    <input type="radio" name="template-block-type" value="money">
                    <span>${templateText("MoneyAllocation")}</span>
                </label>
            </div>
        </div>
        `;

        return new Promise(resolve => new Dialog({
            title: templateText("AddBlock"),
            content,
            buttons: {
                create: {
                    label: templateText("Save"),
                    callback: dlgHtml => {
                        const structure = String(dlgHtml.find("input[name='template-block-type']:checked").val() || "guaranteed");
                        const [type, selectionTarget = "items"] = structure.split(":");
                        const title = (dlgHtml.find("#template-block-title").val() || "").trim();
                        resolve({ type, title, selectionTarget });
                    }
                },
                cancel: { label: templateText("Cancel"), callback: () => resolve(null) }
            },
            default: "create",
            close: () => resolve(null)
        }, { classes: ["dialog", "gum", "template-config-dialog", "template-block-create-config", "gum-sheet-edit-dialog"], width: 450 }).render(true));
    }
    async _onToggleBlock(event) {
        event.preventDefault();

        const blockId = event.currentTarget.dataset.blockId;
        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        block.collapsed = !block.collapsed;
        await this.item.update({ "system.blocks": blocks });
    }

    async _onDeleteBlock(event) {
        event.preventDefault();
        const blockId = event.currentTarget.dataset.blockId;
        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const filtered = blocks.filter(b => b.id !== blockId);
        await this.item.update({ "system.blocks": filtered });
    }

    async _onBlockFieldChange(event) {
        const input = event.currentTarget;
        const blockId = input.dataset.blockId;
        const field = input.dataset.field;
        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        let value;
        if (input.type === "number") value = Number(input.value) || 0;
        else if (input.type === "checkbox") value = input.checked;
        else value = input.value;

        block[field] = value;
        await this.item.update({ "system.blocks": blocks });
    }

    async _showEntryPreview(entry) {
        const sourceItem = entry.uuid ? await fromUuid(entry.uuid).catch(() => null)
            : entry.sourceId ? game.items.get(entry.sourceId) : null;
        await showTemplateEntryPreview(entry, { sourceItem });
    }

    async _onPreviewEntry(event) {
        event.preventDefault();
        const block = (this.item.system.blocks || []).find(candidate => candidate.id === event.currentTarget.dataset.blockId);
        const entry = (block?.contents || []).find(candidate => candidate.id === event.currentTarget.dataset.entryId);
        if (entry) await this._showEntryPreview(entry);
    }

    async _onAddSharedBudget(event) {
        event.preventDefault();
        const content = `<div class="template-budget-form"><div class="form-group template-budget-name"><label for="shared-budget-name">${templateText("Name")}</label><input id="shared-budget-name" type="text"></div>
          <div class="form-group"><label for="shared-budget-type">${templateText("SharedBudgetType")}</label><select id="shared-budget-type">
          <option value="points">${templateText("Points")}</option><option value="money">${templateText("Money")}</option></select></div>
          <div class="form-group"><label for="shared-budget-amount">${templateText("SharedBudgetAmount")}</label><input id="shared-budget-amount" type="number" min="0" value="0"></div>
          <div class="form-group"><label for="shared-budget-policy">${templateText("BudgetPolicy")}</label><select id="shared-budget-policy">
          ${[["hard", "BudgetHard"], ["allow", "BudgetAllow"], ["gm", "BudgetGM"], ["unlimited", "BudgetUnlimited"]]
            .map(([value, label]) => `<option value="${value}">${templateText(label)}</option>`).join("")}</select></div>
          <div class="form-group template-budget-accounting" hidden><label for="shared-budget-accounting">${templateText("MoneyAccounting")}</label><select id="shared-budget-accounting">
          <option value="budget">${templateText("MoneyBudgetOnly")}</option><option value="deduct">${templateText("MoneyDeduct")}</option></select></div></div>`;
        new Dialog({
            title: templateText("AddSharedBudget"), content,
            render: html => {
                const updateAccounting = () => html.find(".template-budget-accounting").prop("hidden", html.find("#shared-budget-type").val() !== "money");
                html.find("#shared-budget-type").on("change", updateAccounting);
                updateAccounting();
            },
            buttons: { save: { label: templateText("Save"), callback: async html => {
                const name = String(html.find("#shared-budget-name").val() || "").trim();
                const type = html.find("#shared-budget-type").val();
                if (!name) return ui.notifications.warn(templateText("SharedBudgetNameRequired"));
                const budgets = foundry.utils.deepClone(this.item.system.sharedBudgets || []);
                if (budgets.some(budget => budget.type === type && String(budget.name).trim().toLocaleLowerCase() === name.toLocaleLowerCase()))
                    return ui.notifications.warn(templateText("SharedBudgetDuplicate"));
                budgets.push({ id: foundry.utils.randomID(), name, type, amount: Number(html.find("#shared-budget-amount").val()) || 0,
                    policy: html.find("#shared-budget-policy").val(), accounting: html.find("#shared-budget-accounting").val() });
                await this.item.update({ "system.sharedBudgets": budgets });
            } }, cancel: { label: templateText("Cancel") } }, default: "save"
        }, { classes: ["dialog", "gum", "template-config-dialog", "template-budget-config", "gum-sheet-edit-dialog"], width: 430 }).render(true);
    }

    async _onDeleteSharedBudget(event) {
        event.preventDefault();
        const id = event.currentTarget.dataset.budgetId;
        const budgets = foundry.utils.deepClone(this.item.system.sharedBudgets || []);
        await this.item.update({ "system.sharedBudgets": budgets.filter(budget => budget.id !== id) });
    }

    async _onSharedBudgetFieldChange(event) {
        const input = event.currentTarget;
        const budgets = foundry.utils.deepClone(this.item.system.sharedBudgets || []);
        const budget = budgets.find(entry => entry.id === input.dataset.budgetId);
        if (!budget) return;
        const value = input.type === "number" ? Number(input.value) || 0 : input.value;
        if (input.dataset.field === "name") {
            const name = String(value).trim();
            if (!name || budgets.some(entry => entry !== budget && entry.type === budget.type &&
                String(entry.name).trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
                ui.notifications.warn(templateText("SharedBudgetDuplicate"));
                this.render(false);
                return;
            }
            budget.name = name;
        } else budget[input.dataset.field] = value;
        await this.item.update({ "system.sharedBudgets": budgets });
    }

    async _onAddAttribute(event) {
        event.preventDefault();
        const blockId = event.currentTarget.dataset.blockId;

        const content = `
        <div class="template-attr-dialog">

            <div class="template-attr-grid-header">
                <span>${templateText("Attribute")}</span>
                <span>${templateText("Increase")}</span>
                <span>${templateText("Cost")}</span>
                <span>${templateText("AttributeLimit")}</span>
            </div>

            <div class="template-attr-grid">
                ${this._renderAttributeFieldRows()}
            </div>
            <div class="template-attr-summary">
                <label class="template-attr-secondary"><input type="checkbox" id="link-secondary"> ${templateText("RecalculateSecondary")}</label>
                <div class="template-attr-total"><label for="template-attr-total-cost">${templateText("TotalCost")}</label><input type="number" id="template-attr-total-cost" value="0" readonly></div>
            </div>
            <div class="template-attr-rule-grid" title="${templateText("RuleNamesHint")}">${this._renderChoiceRuleFields({}, "template-attr")}</div>
        </div>
        `;

        new Dialog({
            title: templateText("AddAttribute"),
            content,
            buttons: {
                save: {
                    label: templateText("Save"),
                    callback: async (dlgHtml) => {
                        const { attributes, costs, attributeLimits, selectedAttributes } = this._readAttributeFields(dlgHtml);

                        const linkSecondary = dlgHtml.find("#link-secondary").is(":checked");
                        const cost = this._calculateAttributeCost(attributes, costs);

                        const entry = {
                            id: foundry.utils.randomID(),
                            kind: "attribute",
                            label: templateText("Attributes"),
                            attributes,
                            costs,
                            attributeLimits,
                            selectedAttributes,
                            linkSecondary,
                            cost
                        };
                        this._readChoiceRuleFields(entry, dlgHtml, "template-attr");

                        await this._appendEntryToBlock(blockId, entry);
                    }
                },
                cancel: { label: templateText("Cancel") }
            },
                default: "save",
                render: (dlgHtml) => {
                    const recalc = () => {
                        const { attributes, costs } = this._readAttributeFields(dlgHtml);

                        dlgHtml.find("#template-attr-total-cost").val(this._calculateAttributeCost(attributes, costs));
                    };

                    dlgHtml.find(".template-attr-grid input[type='number']").on("input", recalc);
                    dlgHtml.find(".template-attr-select").on("change", event => event.currentTarget.closest(".template-attr-row")?.classList.toggle("is-selected", event.currentTarget.checked));
                    dlgHtml.find(".template-attr-select").trigger("change");
                    recalc();
                }
   }, { classes: ["dialog", "gum", "template-config-dialog", "template-attribute-dialog", "gum-sheet-edit-dialog"], width: 620, height: 760 }).render(true);
    }

    async _onAddGroup(event) {
        event.preventDefault();
        const blockId = event.currentTarget.dataset.blockId;

        const content = `<div class="template-group-dialog">
          <div class="form-group"><label>${templateText("PackageName")}</label>
          <input type="text" id="group-name" placeholder="${templateText("SubgroupExample")}"></div>
          <div class="form-group"><label>${templateText("LocalNotes")}</label>
          <input type="text" id="group-notes" placeholder="${templateText("SubgroupNotesExample")}"></div>
          <div class="form-group"><label>${templateText("DisplayCost")}</label><input type="number" id="group-cost" value="0"></div>
          ${this._renderChoiceRuleFields({}, "group")}
          <p class="notes">${templateText("PackageCreatedHint")}</p></div>`;

        new Dialog({
            title: templateText("AddSubgroup"),
            content,
            buttons: {
                save: {
                    label: templateText("Save"),
                    callback: async (dlgHtml) => {
                        const name = String(dlgHtml.find("#group-name").val() || "").trim() || templateText("Package");
                        const localNotes = String(dlgHtml.find("#group-notes").val() || "").trim();
                        const cost = Number(dlgHtml.find("#group-cost").val()) || 0;
                        const entry = {
                            id: foundry.utils.randomID(),
                            kind: "group",
                            name,
                            quantity: 1,
                            level: "",
                            cost,
                            localNotes,
                            subBlocks: [this._createTemplateBlock("guaranteed")]
                        };
                        this._readChoiceRuleFields(entry, dlgHtml, "group");

                        await this._appendEntryToBlock(blockId, entry);
                    }
                },
                cancel: { label: templateText("Cancel") }
            },
            default: "save"
        }, { classes: ["dialog", "gum", "template-config-dialog", "gum-sheet-edit-dialog"], width: 540 }).render(true);
    }

    _createTemplateBlock(type = "guaranteed") {
        return {
            id: foundry.utils.randomID(), type, title: "", choiceCount: 1, choiceExact: false,
            pointsAvailable: 20, moneyAvailable: 1000, budgetPolicy: "hard", moneyAccounting: "budget", moneySourceFilter: "", sharedBudgetKey: "", contents: [], collapsed: false
        };
    }

    _normalizeGroupSubBlocks(rawBlocks) {
        if (!Array.isArray(rawBlocks)) return [];

        return rawBlocks
            .map(block => {
                if (!block || typeof block !== "object") return null;

                const type = ["guaranteed", "selection", "points", "money"].includes(block.type) ? block.type : "guaranteed";
                return {
                    ...block,
                    id: block.id || foundry.utils.randomID(),
                    type,
                    title: String(block.title || "").trim(),
                    choiceCount: Math.max(1, Number(block.choiceCount) || 1),
                    choiceExact: Boolean(block.choiceExact),
                    pointsAvailable: Number(block.pointsAvailable) || 0,
                    moneyAvailable: Number(block.moneyAvailable) || 0,
                    budgetPolicy: ["hard", "allow", "gm", "unlimited"].includes(block.budgetPolicy) ? block.budgetPolicy : "hard",
                    moneyAccounting: block.moneyAccounting === "deduct" ? "deduct" : "budget",
                    moneySourceFilter: String(block.moneySourceFilter || "").trim(),
                    contents: Array.isArray(block.contents) ? block.contents : []
                };
            })
            .filter(Boolean);
    }


    _calculateAttributeCost(attributes, costs = {}) {
        let total = 0;

        for (const [key, value] of Object.entries(attributes)) {
            const increment = Number(value) || 0;
            const costPerLevel = Number(costs[key] ?? this._getAttributeCostPerLevel(key)) || 0;

            if (key === "basic_speed") {
                const quarterSteps = increment / 0.25;
                total += quarterSteps * costPerLevel;
                continue;
            }

            total += increment * costPerLevel;
        }

        return total;
    }

    async _appendEntryToBlock(blockId, entry) {
        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;
        block.contents = block.contents || [];
        block.contents.push(entry);
        await this.item.update({ "system.blocks": blocks });
    }

    async _onDeleteEntry(event) {
        event.preventDefault();
        const blockId = event.currentTarget.dataset.blockId;
        const entryId = event.currentTarget.dataset.entryId;

        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        block.contents = (block.contents || []).filter(e => e.id !== entryId);
        await this.item.update({ "system.blocks": blocks });
    }

    async _onEditEntry(event) {
        event.preventDefault();
        const blockId = event.currentTarget.dataset.blockId;
        const entryId = event.currentTarget.dataset.entryId;

        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        const entry = (block.contents || []).find(e => e.id === entryId);
        if (!entry) return;

  if (entry.kind === "attribute") {
            return this._editAttributeEntry(blockId, entryId, entry);
        }

        if (entry.kind === "group") {
            return this._editGroupEntry(blockId, entryId, entry);
        }

        if (entry.kind === "template") {
            return this._editTemplateEntry(blockId, entryId, entry);
        }

        return this._editItemEntry(blockId, entryId, entry);
    }

    _renderChoiceRuleFields(entry, prefix) {
        const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
        const names = value => Array.isArray(value) ? value.join(", ") : String(value || "");
        return `<div class="form-group"><label>${templateText("RequiresNames")}</label>
          <input type="text" id="${prefix}-requires" value="${esc(names(entry.requiresNames))}"></div>
          <div class="form-group"><label>${templateText("ExcludesNames")}</label>
          <input type="text" id="${prefix}-excludes" value="${esc(names(entry.excludesNames))}"></div>
          <p class="notes">${templateText("RuleNamesHint")}</p>`;
    }

    _readChoiceRuleFields(entry, html, prefix) {
        const parse = key => String(html.find(`#${prefix}-${key}`).val() || "")
            .split(",").map(name => name.trim()).filter(Boolean);
        entry.requiresNames = parse("requires");
        entry.excludesNames = parse("excludes");
    }

    async _editTemplateEntry(blockId, entryId, entry) {
        const content = `<div class="form-group"><label>${templateText("Name")}</label>
          <input type="text" id="template-ref-name" value="${foundry.utils.escapeHTML(entry.name || "")}"></div>
          <div class="form-group"><label>${templateText("DisplayCost")}</label>
          <input type="number" id="template-ref-cost" value="${Number(entry.cost) || 0}"></div>
          <div class="form-group"><label><input type="checkbox" id="template-ref-repeatable" ${entry.repeatable ? "checked" : ""}>
          ${templateText("AllowRepeatedModel")}</label></div>
          ${this._renderChoiceRuleFields(entry, "template-ref")}
          <p class="notes">${templateText("ReferencedModelHint")}</p>`;
        new Dialog({
            title: templateText("ReferencedModel"), content,
            buttons: {
                save: { label: templateText("Save"), callback: async html => {
                    entry.name = String(html.find("#template-ref-name").val() || entry.name).trim();
                    entry.cost = Number(html.find("#template-ref-cost").val()) || 0;
                    entry.repeatable = html.find("#template-ref-repeatable").is(":checked");
                    this._readChoiceRuleFields(entry, html, "template-ref");
                    await this._replaceEntry(blockId, entryId, entry);
                } },
                cancel: { label: templateText("Cancel") }
            }, default: "save"
        }, { classes: ["dialog", "gum", "template-config-dialog", "gum-sheet-edit-dialog"], width: 540 }).render(true);
    }

    async _editGroupEntry(blockId, entryId, entry) {
        const blocks = this._normalizeGroupSubBlocks(foundry.utils.deepClone(entry.subBlocks || []));
        const content = `<div class="template-group-dialog template-package-editor">
          <section class="template-package-settings">
          <div class="template-package-metadata">
            <div class="form-group"><label>${templateText("PackageName")}</label>
            <input type="text" id="group-name" value="${foundry.utils.escapeHTML(entry.name || "")}"></div>
            <div class="form-group"><label>${templateText("LocalNotes")}</label>
            <input type="text" id="group-notes" value="${foundry.utils.escapeHTML(entry.localNotes || "")}"></div>
            <div class="form-group"><label>${templateText("DisplayCost")}</label>
            <input type="number" id="group-cost" value="${Number(entry.cost) || 0}"></div>
          </div>
          <div class="template-package-rule-fields" title="${templateText("RuleNamesHint")}">${this._renderChoiceRuleFields(entry, "group")}</div>
          </section>
          <div class="template-package-section-title"><span>${templateText("Blocks")}</span>
            <button type="button" class="template-package-add-block" title="${templateText("AddBlock")}" aria-label="${templateText("AddBlock")}"><i class="fas fa-plus"></i></button>
          </div>
          <div class="template-package-blocks"></div>
        </div>`;

        new Dialog({
            title: templateText("EditSubgroup"),
            content,
            buttons: {
                save: {
                    label: templateText("Save"),
                    callback: async (dlgHtml) => {
                        const name = String(dlgHtml.find("#group-name").val() || "").trim() || templateText("Package");
                        const localNotes = String(dlgHtml.find("#group-notes").val() || "").trim();
                        const cost = Number(dlgHtml.find("#group-cost").val()) || 0;

                        entry.name = name;
                        entry.localNotes = localNotes;
                        entry.cost = cost;
                        this._readChoiceRuleFields(entry, dlgHtml, "group");
                        entry.subBlocks = this._normalizeGroupSubBlocks(blocks);
                        await this._replaceEntry(blockId, entryId, entry);
                    }
                },
                cancel: { label: templateText("Cancel") }
            },
            default: "save",
            render: html => this._activatePackageEditor(html, blocks)
        }, { classes: ["dialog", "gum", "template-config-dialog", "template-package-dialog", "gum-sheet-edit-dialog"], width: 760, height: 600, resizable: true }).render(true);
    }

    _renderPackageBlocks(blocks) {
        const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
        const typeLabel = type => ({
            guaranteed: templateText("AutomaticDelivery"),
            selection: templateText("Selection"),
            points: templateText("PointAllocation"),
            money: templateText("MoneyAllocation")
        })[type] || templateText("Block");
        return blocks.map(block => {
            const entries = (block.contents || []).map(item => {
              const prepared = this._prepareEntry(item);
              return `<div class="template-package-entry" data-entry-id="${esc(item.id)}">
              <span class="template-package-entry-main"><strong>${esc(prepared.rowName)}</strong>${prepared.rowSubtitle ? `<small>${esc(prepared.rowSubtitle)}</small>` : ""}</span>
              <span class="template-package-entry-meta">
                ${prepared.rowQty !== "-" ? `<span title="${templateText("QuantityShort")}">${templateText("QuantityShort")} ${esc(prepared.rowQty)}</span>` : ""}
                ${prepared.rowLevel !== "-" ? `<span title="${templateText("Level")}">${templateText("Level")} ${esc(prepared.rowLevel)}</span>` : ""}
                ${prepared.rowCost !== "-" ? `<span title="${templateText("Cost")}">${templateText("Cost")} · ${esc(prepared.rowCost)}</span>` : ""}
              </span>
              <span class="template-package-entry-controls"><button type="button" class="template-package-edit-entry" title="${templateText("Edit")}"><i class="fas fa-edit"></i></button>
              <button type="button" class="template-package-delete-entry" title="${templateText("Remove")}"><i class="fas fa-trash"></i></button>
              <button type="button" class="template-package-preview-entry" title="${templateText("PreviewEntry")}"><i class="fas fa-eye"></i></button></span></div>`;
            }).join("");
            const selectionFields = block.type === "selection" ? `<div class="form-group input-narrow"><label>${templateText("ChoiceCount")}</label>
              <input type="number" data-field="choiceCount" min="1" value="${Number(block.choiceCount) || 1}"></div>
              <div class="form-group template-package-checkbox-field"><label class="template-inline-check"><input type="checkbox" data-field="choiceExact" ${block.choiceExact ? "checked" : ""}><span>${templateText("ExactChoices")}</span></label></div>` : "";
            let budgetFields = "";
            if (["points", "money"].includes(block.type)) {
                const budgetField = block.type === "money" ? "moneyAvailable" : "pointsAvailable";
                const budgetLabel = block.type === "money" ? templateText("MoneyAvailable") : templateText("PointsAvailable");
                const budgetValue = block.type === "money" ? Number(block.moneyAvailable) || 0 : Number(block.pointsAvailable) || 0;
                const policyOptions = [["hard", "BudgetHard"], ["allow", "BudgetAllow"], ["gm", "BudgetGM"], ["unlimited", "BudgetUnlimited"]]
                    .map(([value, label]) => `<option value="${value}" ${block.budgetPolicy === value ? "selected" : ""}>${templateText(label)}</option>`).join("");
                const ownBudgetFields = block.sharedBudgetKey ? "" : `<div class="form-group input-narrow"><label>${budgetLabel}</label>
                  <input type="number" data-field="${budgetField}" value="${budgetValue}"></div>
                  <div class="form-group"><label>${templateText("BudgetPolicy")}</label><select data-field="budgetPolicy">${policyOptions}</select></div>`;
                const moneyFields = block.type === "money" ? `<div class="form-group"><label>${templateText("MoneyAccounting")}</label><select data-field="moneyAccounting">
                  <option value="budget" ${block.moneyAccounting !== "deduct" ? "selected" : ""}>${templateText("MoneyBudgetOnly")}</option>
                  <option value="deduct" ${block.moneyAccounting === "deduct" ? "selected" : ""}>${templateText("MoneyDeduct")}</option></select></div>
                  <div class="form-group"><label title="${templateText("PaymentSourceFilterHint")}">${templateText("PaymentSourceFilter")}</label>
                  <input type="text" data-field="moneySourceFilter" value="${esc(block.moneySourceFilter)}" title="${templateText("PaymentSourceFilterHint")}"></div>` : "";
                budgetFields = `<div class="form-group"><label>${templateText("UseSharedBudget")}</label>
                  <input type="text" data-field="sharedBudgetKey" value="${esc(block.sharedBudgetKey)}" placeholder="${templateText("OwnBudget")}"></div>${ownBudgetFields}${moneyFields}`;
            }
            const blockBody = block.collapsed ? "" : `<div class="template-package-block-fields"><div class="form-group"><label>${templateText("CustomTitle")}</label><input type="text" data-field="title" value="${esc(block.title)}" placeholder="${templateText("DefaultTitleHint")}"></div>${selectionFields}${budgetFields}</div>
              <div class="template-package-entries">${entries}</div>
              <div class="template-package-dropzone"><i class="fas fa-box-open"></i> ${templateText("DropItems")}</div>
              <div class="template-package-block-actions"><button type="button" class="template-package-add-attribute"><i class="fas fa-sliders-h"></i> ${templateText("AddAttribute")}</button></div>`;
            return `<section class="template-package-block" data-block-id="${esc(block.id)}">
              <header class="template-package-block-header"><button type="button" class="toggle-template-package-block" aria-expanded="${block.collapsed ? "false" : "true"}" title="${templateText(block.collapsed ? "ExpandBlock" : "CollapseBlock")}" aria-label="${templateText(block.collapsed ? "ExpandBlock" : "CollapseBlock")}"><i class="fas ${block.collapsed ? "fa-chevron-right" : "fa-chevron-down"}"></i></button>
              <div class="template-package-block-heading"><strong class="template-package-block-title">${esc(block.title || typeLabel(block.type))}</strong><small>${esc(typeLabel(block.type))}</small></div>
              <button type="button" class="template-package-delete-block" title="${templateText("RemoveBlock")}"><i class="fas fa-trash"></i></button></header>
              ${blockBody}
            </section>`;
        }).join("") || `<p class="notes">${templateText("NoBlocks")}</p>`;
    }

    _activatePackageEditor(html, blocks) {
        const container = html.find(".template-package-blocks");
        const refresh = () => {
            container.html(this._renderPackageBlocks(blocks));
            container.find("[data-field]").on("change", event => {
                const section = event.currentTarget.closest(".template-package-block");
                const block = blocks.find(candidate => candidate.id === section?.dataset?.blockId);
                if (!block) return;
                const input = event.currentTarget;
                block[input.dataset.field] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) || 0 : input.value;
                if (["title", "sharedBudgetKey"].includes(input.dataset.field)) refresh();
            });
            container.find(".toggle-template-package-block").on("click", event => {
                event.preventDefault();
                const id = event.currentTarget.closest(".template-package-block")?.dataset?.blockId;
                const block = blocks.find(candidate => candidate.id === id);
                if (!block) return;
                block.collapsed = !block.collapsed;
                refresh();
            });
            container.find(".template-package-delete-block").on("click", event => {
                const id = event.currentTarget.closest(".template-package-block")?.dataset?.blockId;
                const index = blocks.findIndex(block => block.id === id);
                if (index >= 0) blocks.splice(index, 1);
                refresh();
            });
            container.find(".template-package-delete-entry").on("click", event => {
                const section = event.currentTarget.closest(".template-package-block");
                const block = blocks.find(candidate => candidate.id === section?.dataset?.blockId);
                const entryId = event.currentTarget.closest(".template-package-entry")?.dataset?.entryId;
                if (block) block.contents = (block.contents || []).filter(item => item.id !== entryId);
                refresh();
            });
            container.find(".template-package-edit-entry").on("click", async event => {
                const section = event.currentTarget.closest(".template-package-block");
                const block = blocks.find(candidate => candidate.id === section?.dataset?.blockId);
                const entryId = event.currentTarget.closest(".template-package-entry")?.dataset?.entryId;
                const entry = (block?.contents || []).find(item => item.id === entryId);
                if (entry && await this._editPackageLocalEntry(entry)) refresh();
            });
            container.find(".template-package-preview-entry").on("click", async event => {
                event.preventDefault();
                const section = event.currentTarget.closest(".template-package-block");
                const block = blocks.find(candidate => candidate.id === section?.dataset?.blockId);
                const entryId = event.currentTarget.closest(".template-package-entry")?.dataset?.entryId;
                const entry = (block?.contents || []).find(item => item.id === entryId);
                if (entry) await this._showEntryPreview(entry);
            });
            container.find(".template-package-add-attribute").on("click", async event => {
                const blockId = event.currentTarget.closest(".template-package-block")?.dataset?.blockId;
                const block = blocks.find(candidate => candidate.id === blockId);
                const attribute = await this._createPackageAttributeEntry();
                if (!block || !attribute) return;
                block.contents ||= [];
                block.contents.push(attribute);
                refresh();
            });
            container.find(".template-package-dropzone").on("dragover", event => event.preventDefault()).on("drop", async event => {
                event.preventDefault();
                const blockId = event.currentTarget.closest(".template-package-block")?.dataset?.blockId;
                const block = blocks.find(candidate => candidate.id === blockId);
                if (!block) return;
                const item = await this._resolveTemplateDroppedItem(event.originalEvent || event);
                if (!item) return;
                const newEntry = await this._buildTemplateDropEntry(item);
                if (!newEntry) return;
                block.contents ||= [];
                block.contents.push(newEntry);
                refresh();
            });
        };
        html.find(".template-package-add-block").on("click", async event => {
            event.preventDefault();
            const config = await this._promptTemplateBlockConfiguration();
            if (!config) return;
            blocks.push({ ...this._createTemplateBlock(config.type), title: config.title, selectionTarget: config.selectionTarget, collapsed: false });
            refresh();
        });
        refresh();
    }

    _createPackageAttributeEntry(existing = {}) {
        const content = `<div class="template-attr-dialog"><div class="template-attr-grid-header">
          <span>${templateText("Attribute")}</span><span>${templateText("Increase")}</span><span>${templateText("Cost")}</span><span>${templateText("AttributeLimit")}</span></div>
          <div class="template-attr-grid">${this._renderAttributeFieldRows(existing.attributes || {}, existing.costs || {}, existing.attributeLimits || {}, existing.selectedAttributes)}</div>
          <div class="form-group"><label><input type="checkbox" id="link-secondary" ${existing.linkSecondary ? "checked" : ""}> ${templateText("RecalculateSecondary")}</label></div>
          <div class="template-attr-rule-grid" title="${templateText("RuleNamesHint")}">${this._renderChoiceRuleFields(existing, "package-attr")}</div></div>`;
        return new Promise(resolve => new Dialog({
            title: templateText("AddAttribute"), content,
            buttons: {
                save: { label: templateText("Save"), callback: html => {
                    const { attributes, costs, attributeLimits, selectedAttributes } = this._readAttributeFields(html);
                    const entry = { id: foundry.utils.randomID(), kind: "attribute", label: templateText("Attributes"), attributes, costs, attributeLimits, selectedAttributes,
                        linkSecondary: html.find("#link-secondary").is(":checked"), cost: this._calculateAttributeCost(attributes, costs) };
                    this._readChoiceRuleFields(entry, html, "package-attr");
                    resolve(entry);
                } },
                cancel: { label: templateText("Cancel"), callback: () => resolve(null) }
            }, default: "save", close: () => resolve(null)
        }, { classes: ["dialog", "gum", "template-config-dialog", "template-attribute-dialog", "gum-sheet-edit-dialog"], width: 620, height: 760 }).render(true));
    }

    async _editPackageLocalEntry(entry) {
        if (entry.kind === "attribute") {
            const replacement = await this._createPackageAttributeEntry(entry);
            if (!replacement) return false;
            Object.assign(entry, replacement, { id: entry.id });
            return true;
        }
        const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
        const isTemplate = entry.kind === "template";
        const isEquipment = entry.itemType === "equipment";
        const content = `<div class="form-group"><label>${templateText("Name")}</label><input id="package-entry-name" value="${esc(entry.name || entry.label)}"></div>
          <div class="form-group"><label>${templateText("DisplayCost")}</label><input type="number" id="package-entry-cost" value="${Number(entry.cost) || 0}"></div>
          ${isEquipment ? `<div class="form-group"><label>${templateText("Quantity")}</label><input type="number" id="package-entry-quantity" min="1" value="${Math.max(1, Number(entry.quantity) || 1)}"></div>
          <div class="form-group"><label>${templateText("EquipmentPointCost")}</label><input type="number" id="package-entry-points" min="0" value="${Number(entry.pointsCost) || 0}"></div>
          <div class="form-group"><label title="${templateText("QuantityConsumesChoicesHint")}"><input type="checkbox" id="package-entry-selection-quantity" ${entry.selectionQuantity ? "checked" : ""}> ${templateText("QuantityConsumesChoices")}</label></div>` : ""}
          ${isTemplate ? `<div class="form-group"><label><input type="checkbox" id="package-entry-repeatable" ${entry.repeatable ? "checked" : ""}> ${templateText("AllowRepeatedModel")}</label></div>` : ""}
          ${this._renderChoiceRuleFields(entry, "package-entry")}`;
        return new Promise(resolve => new Dialog({
            title: templateText(isTemplate ? "ReferencedModel" : "EditBlockItem"), content,
            buttons: {
                save: { label: templateText("Save"), callback: html => {
                    entry.name = String(html.find("#package-entry-name").val() || entry.name).trim();
                    entry.cost = Number(html.find("#package-entry-cost").val()) || 0;
                    if (isEquipment) {
                        entry.quantity = Math.max(1, Number(html.find("#package-entry-quantity").val()) || 1);
                        entry.pointsCost = Math.max(0, Number(html.find("#package-entry-points").val()) || 0);
                        entry.selectionQuantity = html.find("#package-entry-selection-quantity").is(":checked");
                    }
                    if (isTemplate) entry.repeatable = html.find("#package-entry-repeatable").is(":checked");
                    this._readChoiceRuleFields(entry, html, "package-entry");
                    resolve(true);
                } },
                cancel: { label: templateText("Cancel"), callback: () => resolve(false) }
            }, default: "save", close: () => resolve(false)
        }, { classes: ["dialog", "gum", "template-config-dialog", "gum-sheet-edit-dialog"], width: 560 }).render(true));
    }

    async _editAttributeEntry(blockId, entryId, entry) {
        const attrs = entry.attributes || {};
        const costs = entry.costs || {};

        const content = `
        <div class="template-attr-dialog">
            <div class="template-attr-grid-header">
                <span>${templateText("Attribute")}</span>
                <span>${templateText("Increase")}</span>
                <span>${templateText("Cost")}</span>
                <span>${templateText("AttributeLimit")}</span>
            </div>

            <div class="template-attr-grid">
                ${this._renderAttributeFieldRows(attrs, costs, entry.attributeLimits || {}, entry.selectedAttributes)}
            </div>

            <div class="template-attr-summary">
                <label class="template-attr-secondary"><input type="checkbox" id="link-secondary" ${entry.linkSecondary ? "checked" : ""}> ${templateText("RecalculateSecondary")}</label>
                <div class="template-attr-total"><label for="template-attr-total-cost">${templateText("TotalCost")}</label><input type="number" id="template-attr-total-cost" value="${entry.cost || 0}" readonly></div>
            </div>
            <div class="template-attr-rule-grid" title="${templateText("RuleNamesHint")}">${this._renderChoiceRuleFields(entry, "template-attr")}</div>
        </div>
        `;

        new Dialog({
            title: templateText("EditAttribute"),
            content,
            buttons: {
                save: {
                    label: templateText("Save"),
                    callback: async (dlgHtml) => {
                        ({ attributes: entry.attributes, costs: entry.costs, attributeLimits: entry.attributeLimits, selectedAttributes: entry.selectedAttributes } = this._readAttributeFields(dlgHtml));

                        entry.linkSecondary = dlgHtml.find("#link-secondary").is(":checked");
                        entry.cost = this._calculateAttributeCost(entry.attributes, entry.costs);
                        this._readChoiceRuleFields(entry, dlgHtml, "template-attr");

                        await this._replaceEntry(blockId, entryId, entry);
                    }
                },
                cancel: { label: templateText("Cancel") }
            },
            default: "save",
            render: (dlgHtml) => {
                const recalc = () => {
                    const { attributes, costs } = this._readAttributeFields(dlgHtml);

                    dlgHtml.find("#template-attr-total-cost").val(
                        this._calculateAttributeCost(attributes, costs)
                    );
                };

                dlgHtml.find(".template-attr-grid input[type='number']").on("input", recalc);
                dlgHtml.find(".template-attr-select").on("change", event => event.currentTarget.closest(".template-attr-row")?.classList.toggle("is-selected", event.currentTarget.checked));
                dlgHtml.find(".template-attr-select").trigger("change");
                recalc();
            }
        }, { classes: ["dialog", "gum", "template-config-dialog", "template-attribute-dialog", "gum-sheet-edit-dialog"], width: 620, height: 760 }).render(true);
    }

    async _editItemEntry(blockId, entryId, entry) {
        const isEquipment = entry.itemType === "equipment";
        const isTrait = ["advantage", "disadvantage"].includes(entry.itemType) && Boolean(entry.trait_cost);
        const supportsLevelCap = ["skill", "spell", "power"].includes(entry.itemType) || (isTrait && entry.trait_cost.can_level);
        const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
        const levelLabel = isEquipment ? templateText("LevelOrValue") : templateText("Level");
        const groupMode = entry.destinationMode || (entry.destinationGroup ? "group" : "inherit");
        const containerMode = entry.containerMode || (entry.containerName ? "new" : "inherit");
        const content = `
        <div class="template-entry-edit-form">
        <div class="form-group template-edit-name">
            <label for="entry-name">${templateText("Name")}</label>
            <input type="text" id="entry-name" value="${esc(entry.name)}">
        </div>
        <div class="template-entry-basic-fields ${isEquipment ? "template-entry-basic-fields--equipment" : ""}">
            ${isEquipment ? `<div class="form-group template-entry-quantity-field">
                <label>${templateText("Quantity")}</label>
                <span class="template-entry-quantity-stepper"><button type="button" class="template-entry-quantity-step" data-step="-1" title="-" aria-label="-"><i class="fas fa-minus"></i></button><input type="number" id="entry-qty" value="${entry.quantity ?? 1}" min="1"><button type="button" class="template-entry-quantity-step" data-step="1" title="+" aria-label="+"><i class="fas fa-plus"></i></button></span>
            </div>` : ""}
            ${isTrait ? `<div class="form-group">
                <label>${templateText("BaseCost")}</label>
                <input type="number" id="entry-base-cost" value="${entry.trait_cost.points ?? 0}">
            </div>
            <div class="form-group">
                <label>${templateText("PointsPerLevel")}</label>
                <input type="number" id="entry-points-per-level" value="${entry.trait_cost.points_per_level ?? 0}">
            </div>
            <div class="form-group">
                <label>${templateText("Level")}</label>
                <input type="number" id="entry-level" value="${entry.trait_cost.level ?? entry.level ?? 0}" min="0">
            </div>` : `<div class="form-group">
                <label title="${isEquipment ? templateText("EntryLevelValueHint") : ""}">${levelLabel}</label>
                <input type="text" id="entry-level" value="${esc(entry.level)}">
            </div>
            <div class="form-group">
                <label title="${isEquipment ? templateText("EntryCostHint") : ""}">${templateText("Cost")}</label>
                <input type="number" id="entry-cost" value="${entry.cost ?? 0}">
            </div>`}
            ${supportsLevelCap ? `<div class="form-group">
                <label>${templateText("MaximumLevel")}</label>
                <input type="number" id="entry-max-level" value="${entry.maxLevel ?? ""}" placeholder="${templateText("NoLevelLimit")}">
            </div>` : ""}
        </div>
        <div class="template-entry-destination">
        ${!isEquipment ? `<div class="form-group"><label for="entry-destination-mode">${templateText("GroupDestinationMode")}</label><select id="entry-destination-mode">
          <option value="inherit" ${groupMode === "inherit" ? "selected" : ""}>${templateText("InheritBlock")}</option>
          <option value="group" ${groupMode === "group" ? "selected" : ""}>${templateText("UseNamedGroup")}</option>
          <option value="source" ${groupMode === "source" ? "selected" : ""}>${templateText("KeepSourceGroup")}</option>
        </select></div><div class="form-group template-destination-name"><label for="entry-destination-group">${game.i18n.localize("GUM.Template.DestinationGroup")}</label>
          <input type="text" id="entry-destination-group" value="${foundry.utils.escapeHTML(entry.destinationGroup || "")}" placeholder="${game.i18n.localize("GUM.Template.InheritBlock")}"></div>` : ""}
        ${isEquipment ? `<div class="form-group"><label for="entry-container-mode">${templateText("ContainerDestinationMode")}</label><select id="entry-container-mode">
          <option value="inherit" ${containerMode === "inherit" ? "selected" : ""}>${templateText("InheritBlock")}</option>
          <option value="new" ${containerMode === "new" ? "selected" : ""}>${templateText("CreateContainer")}</option>
          <option value="loose" ${containerMode === "loose" ? "selected" : ""}>${templateText("LooseEquipment")}</option>
        </select></div><div class="form-group template-destination-name"><label for="entry-container-name">${game.i18n.localize("GUM.Template.NewContainer")}</label>
          <input type="text" id="entry-container-name" value="${foundry.utils.escapeHTML(entry.containerName || "")}" placeholder="${game.i18n.localize("GUM.Template.InheritBlock")}"></div>` : ""}
        </div>
        ${isEquipment ? `<div class="form-group"><label for="entry-points-cost">${templateText("EquipmentPointCost")}</label>
          <input type="number" id="entry-points-cost" value="${Number(entry.pointsCost) || 0}" min="0"></div>
          <div class="form-group template-entry-selection-quantity"><label for="entry-selection-quantity" title="${templateText("QuantityConsumesChoicesHint")}"><input type="checkbox" id="entry-selection-quantity" ${entry.selectionQuantity ? "checked" : ""}><span>${templateText("QuantityConsumesChoices")}</span></label></div>` : ""}
        <div class="template-entry-rule-fields" title="${templateText("RuleNamesHint")}">${this._renderChoiceRuleFields(entry, "entry")}</div>
        </div>
        `;

        new Dialog({
            title: templateText("EditBlockItem"),
            content,
            buttons: {
                save: {
                    label: templateText("Save"),
                    callback: async (dlgHtml) => {
                        entry.name = dlgHtml.find("#entry-name").val();
                        if (isEquipment) {
                            entry.quantity = Number(dlgHtml.find("#entry-qty").val()) || 1;
                            entry.selectionQuantity = dlgHtml.find("#entry-selection-quantity").is(":checked");
                        }
                        entry.level = dlgHtml.find("#entry-level").val();
                        if (supportsLevelCap) {
                            const rawMaxLevel = dlgHtml.find("#entry-max-level").val();
                            entry.maxLevel = rawMaxLevel === "" ? null : Number(rawMaxLevel);
                            if (entry.maxLevel !== null && Number(entry.level) > entry.maxLevel) entry.level = entry.maxLevel;
                        }
                        this._readChoiceRuleFields(entry, dlgHtml, "entry");
                        if (!isEquipment) {
                            entry.destinationMode = String(dlgHtml.find("#entry-destination-mode").val() || "inherit");
                            entry.destinationGroup = String(dlgHtml.find("#entry-destination-group").val() || "").trim();
                        }
                        if (isEquipment) {
                            entry.containerMode = String(dlgHtml.find("#entry-container-mode").val() || "inherit");
                            entry.containerName = String(dlgHtml.find("#entry-container-name").val() || "").trim();
                        }
                        if (entry.destinationMode === "group" && !entry.destinationGroup) {
                            ui.notifications.warn(templateText("GroupNameRequired"));
                            return false;
                        }
                        if (entry.containerMode === "new" && !entry.containerName) {
                            ui.notifications.warn(templateText("ContainerNameRequired"));
                            return false;
                        }
                        if (isEquipment) entry.pointsCost = Math.max(0, Number(dlgHtml.find("#entry-points-cost").val()) || 0);
                        if (entry.trait_cost) {
                            entry.trait_cost.points = Number(dlgHtml.find("#entry-base-cost").val()) || 0;
                            entry.trait_cost.points_per_level = Number(dlgHtml.find("#entry-points-per-level").val()) || 0;
                            entry.trait_cost.level = Number(entry.level);
                            entry.level = entry.trait_cost.level;
                            entry.cost = calculateTraitCost(entry.trait_cost).finalPoints;
                        } else entry.cost = Number(dlgHtml.find("#entry-cost").val()) || 0;
                        await this._replaceEntry(blockId, entryId, entry);
                    }
                },
                cancel: { label: templateText("Cancel") }
            },
            default: "save",
            render: html => {
                const selector = html.find(isEquipment ? "#entry-container-mode" : "#entry-destination-mode");
                const updateDestination = () => html.find(".template-destination-name").toggle(selector.val() === (isEquipment ? "new" : "group"));
                selector.on("change", updateDestination);
                html.find(".template-entry-quantity-step").on("click", event => {
                    event.preventDefault();
                    const input = html.find("#entry-qty");
                    input.val(Math.max(1, (Number(input.val()) || 1) + (Number(event.currentTarget.dataset.step) || 0)));
                });
                updateDestination();
            }
        }, { classes: ["dialog", "gum", "template-config-dialog", "template-entry-config-dialog", "gum-sheet-edit-dialog"], width: 480 }).render(true);
    }

    async _replaceEntry(blockId, entryId, newEntry) {
        const blocks = foundry.utils.deepClone(this.item.system.blocks || []);
        const block = blocks.find(b => b.id === blockId);
        if (!block) return;

        const index = (block.contents || []).findIndex(e => e.id === entryId);
        if (index < 0) return;

        block.contents[index] = newEntry;
        await this.item.update({ "system.blocks": blocks });
    }

    async _onDrop(event) {
        event.preventDefault();

        const blockEl = event.currentTarget.closest(".template-block");
        const blockId = blockEl?.dataset?.blockId;
        if (!blockId) return;

        const item = await this._resolveTemplateDroppedItem(event);
        if (!item) return;

        const entry = await this._buildTemplateDropEntry(item);
        if (!entry) return;
        await this._appendEntryToBlock(blockId, entry);
    }

    async _resolveTemplateDroppedItem(event) {
        const data = TextEditor.getDragEventData(event);
        let item = null;
        if (data.uuid) item = await fromUuid(data.uuid).catch(() => null);
        if (!item && data.type === "Item" && data.id) item = game.items.get(data.id);
        return item;
    }

    async _buildTemplateDropEntry(item) {
        if (item.type === "template") {
            if (item.uuid === this.item.uuid || item.id === this.item.id) {
                ui.notifications.warn(templateText("DirectSelfReference"));
                return null;
            }
            return {
                id: foundry.utils.randomID(), kind: "template", uuid: item.uuid, sourceId: item.id,
                name: item.name, img: item.img, cost: 0, subBlocks: []
            };
        }

        if (!["skill", "spell", "power", "advantage", "disadvantage", "equipment"].includes(item.type)) {
            ui.notifications.warn(templateText("UnsupportedItem"));
            return null;
        }

        const entry = await this._buildEntryFromItem(item);
        return entry || null;
    }

    async _buildEntryFromItem(item) {
        const base = {
            id: foundry.utils.randomID(),
            kind: "item",
            itemType: item.type,
            uuid: item.uuid,
            sourceId: item.id,
            name: item.name,
            img: item.img,
            quantity: 1,
            level: "",
            cost: 0,
            pointsCost: 0
        };

        if (item.type === "equipment") {
            return this._promptEquipmentEntry(item, base);
        }

        if (["skill", "spell", "power"].includes(item.type)) {
            return this._promptLevelledEntry(item, base);
        }

        if (["advantage", "disadvantage"].includes(item.type)) {
            return this._promptAdvantageEntry(item, base);
        }

        return base;
    }

    async _promptEquipmentEntry(item, base) {
        return new Promise(resolve => {
            new Dialog({
                title: `${templateText("Add")}: ${item.name}`,
                content: `
                <div class="template-equipment-add-fields"><div class="form-group template-equipment-add-quantity">
                    <label>${templateText("Quantity")}</label>
                    <span class="template-entry-quantity-stepper"><button type="button" class="template-entry-quantity-step" data-step="-1" title="-" aria-label="-"><i class="fas fa-minus"></i></button><input type="number" id="entry-qty" value="1" min="1"><button type="button" class="template-entry-quantity-step" data-step="1" title="+" aria-label="+"><i class="fas fa-plus"></i></button></span>
                </div><div class="form-group template-equipment-add-level">
                    <label title="${templateText("EntryLevelValueHint")}">${templateText("LevelOrValue")}</label>
                    <input type="text" id="entry-level" value="${foundry.utils.escapeHTML(String(base.level || ""))}">
                </div></div>`,
                buttons: {
                    save: {
                        label: templateText("Add"),
                        callback: (html) => {
                            base.quantity = Number(html.find("#entry-qty").val()) || 1;
                            base.level = String(html.find("#entry-level").val() || "").trim();
                            base.cost = item.system?.cost ?? 0;
                            resolve(base);
                        }
                    },
                    cancel: {
                        label: templateText("Cancel"),
                        callback: () => resolve(null)
                    }
                },
                default: "save",
                render: html => html.find(".template-entry-quantity-step").on("click", event => {
                    event.preventDefault();
                    const input = html.find("#entry-qty");
                    input.val(Math.max(1, (Number(input.val()) || 1) + (Number(event.currentTarget.dataset.step) || 0)));
                })
            }, { classes: ["dialog", "gum", "template-config-dialog", "template-equipment-add-dialog", "gum-sheet-edit-dialog"], width: 340 }).render(true);
        });
    }

    async _promptLevelledEntry(item, base) {
        const levelValue = Number(item.system?.skill_level ?? item.system?.level ?? 0) || 0;
        const difficultyValue = this._getItemDifficulty(item);
        const pointsInfo = this._getPointsPerLevelInfo(item);
        const itemTypeLabel = this._getItemTypeLabel(item.type);

        return new Promise(resolve => {
            new Dialog({
                title: `${templateText("Add")}: ${item.name}`,
                content: `
                <div class="template-level-dialog">
                    <div class="template-level-dialog__title">${foundry.utils.escapeHTML(item.name || "Item")}</div>
                    <div class="template-level-dialog__subtitle">${foundry.utils.escapeHTML(itemTypeLabel)}</div>
                    <hr>

                    ${difficultyValue ? `
                    <div class="template-level-dialog__row">
                        <label>${templateText("Difficulty")}</label>
                        <input type="text" value="${foundry.utils.escapeHTML(difficultyValue)}" readonly>
                    </div>` : ""}

                    <div class="template-level-dialog__row">
                        <label>${templateText("PointsPerLevel")}</label>
                        <input type="text" value="${foundry.utils.escapeHTML(pointsInfo)}" readonly>
                    </div>

                    <div class="template-level-dialog__row">
                        <label>${templateText("RelativeLevel")}</label>
                        <div class="template-level-stepper">
                            <button type="button" class="template-level-decrease" title="${templateText("Decrease")}" aria-label="${templateText("Decrease")}"><i class="fas fa-minus"></i></button>
                            <input type="number" id="entry-level" value="${levelValue}">
                            <button type="button" class="template-level-increase" title="${templateText("Increase")}" aria-label="${templateText("Increase")}"><i class="fas fa-plus"></i></button>
                        </div>
                    </div>

                    <div class="template-level-dialog__row">
                        <label>${templateText("MaximumLevel")}</label>
                        <input type="number" id="entry-max-level" value="" placeholder="${templateText("NoLevelLimit")}">
                    </div>

                    <div class="template-level-dialog__row">
                        <label>${templateText("TotalCost")}</label>
                        <input type="number" id="entry-total-cost" value="${this._calculateLevelledItemCost(item, levelValue)}" readonly>
                    </div>
                </div>`,
                buttons: {
                    save: {
                        label: templateText("Add"),
                        callback: (html) => {
                            const rawMaxLevel = html.find("#entry-max-level").val();
                            base.maxLevel = rawMaxLevel === "" ? null : Number(rawMaxLevel);
                            const level = Number(html.find("#entry-level").val()) || 0;
                            base.level = base.maxLevel === null ? level : Math.min(level, base.maxLevel);
                            base.cost = this._calculateLevelledItemCost(item, base.level);
                            resolve(base);
                        }
                    },
                    cancel: {
                        label: templateText("Cancel"),
                        callback: () => resolve(null)
                    }
                },
                default: "save",
                render: (html) => {
                    const levelInput = html.find("#entry-level");
                    const totalInput = html.find("#entry-total-cost");
                    levelInput.on("input", () => {
                        const level = Number(levelInput.val()) || 0;
                        totalInput.val(this._calculateLevelledItemCost(item, level));
                    });
                    html.find(".template-level-decrease, .template-level-increase").on("click", event => {
                        const change = event.currentTarget.classList.contains("template-level-increase") ? 1 : -1;
                        levelInput.val((Number(levelInput.val()) || 0) + change).trigger("input");
                    });
                }
            }, { classes: ["dialog", "gum", "template-config-dialog", "template-level-config-dialog", "gum-sheet-edit-dialog"], width: 500 }).render(true);
        });
    }

    async _promptAdvantageEntry(item, base) {
        base.trait_cost = foundry.utils.deepClone(traitCostInput(item.system));
        const fixedCost = calculateTraitCost(base.trait_cost).finalPoints;
        const currentLevel = item.system?.level ?? "";

        if (!item.system.can_level) {
            base.cost = fixedCost;
            return base;
        }

        return new Promise(resolve => {
            new Dialog({
                title: `${templateText("Add")}: ${item.name}`,
                content: `
                <div class="template-entry-basic-fields">
                    <div class="form-group">
                        <label>${templateText("BaseCost")}</label>
                        <input type="number" id="entry-base-cost" value="${base.trait_cost.points ?? 0}">
                    </div>
                    <div class="form-group">
                        <label>${templateText("PointsPerLevel")}</label>
                        <input type="number" id="entry-points-per-level" value="${base.trait_cost.points_per_level ?? 0}">
                    </div>
                    <div class="form-group">
                        <label>${templateText("Level")}</label>
                        <input type="number" id="entry-level" value="${currentLevel}" min="0">
                    </div>
                    <div class="form-group">
                        <label>${templateText("MaximumLevel")}</label>
                        <input type="number" id="entry-max-level" value="" min="0" placeholder="${templateText("NoLevelLimit")}">
                    </div>
                    <div class="form-group">
                        <label>${templateText("FinalCost")}</label>
                        <input type="number" id="entry-cost" value="${fixedCost}" readonly>
                    </div>
                </div>`,
                buttons: {
                    save: {
                        label: templateText("Add"),
                    callback: (html) => {
                        const rawMaxLevel = html.find("#entry-max-level").val();
                        base.maxLevel = rawMaxLevel === "" ? null : Number(rawMaxLevel);
                        base.level = Number(html.find("#entry-level").val()) || 0;
                        if (base.maxLevel !== null) base.level = Math.min(base.level, base.maxLevel);
                        base.trait_cost.points = Number(html.find("#entry-base-cost").val()) || 0;
                        base.trait_cost.points_per_level = Number(html.find("#entry-points-per-level").val()) || 0;
                        base.trait_cost.level = Number(base.level);
                            base.cost = calculateTraitCost(base.trait_cost).finalPoints;
                            resolve(base);
                        }
                    },
                    cancel: {
                        label: templateText("Cancel"),
                        callback: () => resolve(null)
                    }
                },
                default: "save",
                render: html => html.find("#entry-base-cost, #entry-points-per-level, #entry-level").on("input", () => {
                    const level = Number(html.find("#entry-level").val()) || 0;
                    const points = Number(html.find("#entry-base-cost").val()) || 0;
                    const points_per_level = Number(html.find("#entry-points-per-level").val()) || 0;
                    html.find("#entry-cost").val(calculateTraitCost({ ...base.trait_cost, points, points_per_level, level }).finalPoints);
                })
            }, { classes: ["dialog", "gum", "template-config-dialog", "gum-sheet-edit-dialog"], width: 600 }).render(true);
        });
    }

    _getItemDifficulty(item) {
        const raw = item.system?.difficulty;
        if (raw === undefined || raw === null || raw === "") return "";

        const map = {
            "E": "Fácil",
            "A": "Média",
            "H": "Difícil",
            "VH": "Muito Difícil",
            "F": "Fácil",
            "M": "Média",
            "D": "Difícil",
            "MD": "Muito Difícil",
            "TecM": "Técnica Média",
            "TecD": "Técnica Difícil"
        };

        return map[raw] || String(raw);
    }

    _getPointsPerLevelInfo(item) {
        const difficulty = item.system?.difficulty ?? "M";
        const normalized = ({
            "E": "F", "A": "M", "H": "D", "VH": "MD"
        })[difficulty] || difficulty;

        if (normalized === "TecM") return "Progressão técnica: +1 ponto por nível";
        if (normalized === "TecD") return "Progressão técnica difícil: 2 pontos no primeiro nível, +1 ponto por nível adicional";

        const tables = {
            "F": "Tabela Fácil (1, 2, 4, 8, 12, 16...)",
            "M": "Tabela Média (1, 2, 4, 8, 12, 16, 20...)",
            "D": "Tabela Difícil (1, 2, 4, 8, 12, 16, 20, 24...)",
            "MD": "Tabela Muito Difícil (1, 2, 4, 8, 12, 16, 20, 24, 28...)"
        };

        return tables[normalized] || "Progressão por tabela do sistema";
    }

    _calculateLevelledItemCost(item, level) {
        const difficulty = item.system?.difficulty ?? "M";
        const normalized = ({
            "E": "F", "A": "M", "H": "D", "VH": "MD"
        })[difficulty] || difficulty;

        const tables = {
            "F": { 0: 1, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16 },
            "M": { "-1": 1, 0: 2, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20 },
            "D": { "-2": 1, "-1": 2, 0: 4, 1: 8, 2: 12, 3: 16, 4: 20, 5: 24 },
            "MD": { "-3": 1, "-2": 2, "-1": 4, 0: 8, 1: 12, 2: 16, 3: 20, 4: 24, 5: 28 },
            "TecM": {},
            "TecD": {}
        };

        if (normalized === "TecM") return Math.max(0, level * 1);
        if (normalized === "TecD") return level > 0 ? level + 1 : 0;

        const table = tables[normalized] || tables["M"];
        const rl = Number(level) || 0;
        const keys = Object.keys(table).map(k => parseInt(k));
        const minKey = Math.min(...keys);
        const maxKey = Math.max(...keys);

        if (rl < minKey) return 0;
        if (rl in table) return table[rl];

        const base = table[maxKey];
        return base + (rl - maxKey) * 4;
    }
}
