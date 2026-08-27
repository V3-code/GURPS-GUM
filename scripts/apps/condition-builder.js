import { GUM_DATA } from "../gum-data.js";
import { TriggerBrowser } from "../../module/apps/trigger-browser.js";

const localize = key => game.i18n.localize(key);
const escapeHtml = value => foundry.utils.escapeHTML(String(value ?? ""));
const ATTRIBUTE_LABEL_KEYS = {
    "attributes.st.temp": "GUM.ConditionBuilder.Attributes.attributes_st_temp",
    "attributes.dx.temp": "GUM.ConditionBuilder.Attributes.attributes_dx_temp",
    "attributes.iq.temp": "GUM.ConditionBuilder.Attributes.attributes_iq_temp",
    "attributes.ht.temp": "GUM.ConditionBuilder.Attributes.attributes_ht_temp",
    "attributes.vont.temp": "GUM.ConditionBuilder.Attributes.attributes_vont_temp",
    "attributes.per.temp": "GUM.ConditionBuilder.Attributes.attributes_per_temp",
    "attributes.hp.temp": "GUM.ConditionBuilder.Attributes.attributes_hp_temp",
    "attributes.fp.temp": "GUM.ConditionBuilder.Attributes.attributes_fp_temp",
    "attributes.lifting_st.temp": "GUM.ConditionBuilder.Attributes.attributes_lifting_st_temp",
    "attributes.mt.temp": "GUM.ConditionBuilder.Attributes.attributes_mt_temp",
    "attributes.basic_speed.temp": "GUM.ConditionBuilder.Attributes.attributes_basic_speed_temp",
    "attributes.basic_move.temp": "GUM.ConditionBuilder.Attributes.attributes_basic_move_temp",
    "attributes.enhanced_move.temp": "GUM.ConditionBuilder.Attributes.attributes_enhanced_move_temp",
    "attributes.final_dodge": "GUM.ConditionBuilder.Attributes.attributes_final_dodge",
    "attributes.final_move": "GUM.ConditionBuilder.Attributes.attributes_final_move",
    "attributes.enhanced_move.final": "GUM.ConditionBuilder.Attributes.attributes_enhanced_move_final",
    "combat.dr_mods.head": "GUM.ConditionBuilder.Attributes.combat_dr_mods_head",
    "combat.dr_mods.face": "GUM.ConditionBuilder.Attributes.combat_dr_mods_face",
    "combat.dr_mods.neck": "GUM.ConditionBuilder.Attributes.combat_dr_mods_neck",
    "combat.dr_mods.torso": "GUM.ConditionBuilder.Attributes.combat_dr_mods_torso",
    "combat.dr_mods.vitals": "GUM.ConditionBuilder.Attributes.combat_dr_mods_vitals",
    "combat.dr_mods.groin": "GUM.ConditionBuilder.Attributes.combat_dr_mods_groin",
    "combat.dr_mods.arms": "GUM.ConditionBuilder.Attributes.combat_dr_mods_arms",
    "combat.dr_mods.hands": "GUM.ConditionBuilder.Attributes.combat_dr_mods_hands",
    "combat.dr_mods.legs": "GUM.ConditionBuilder.Attributes.combat_dr_mods_legs",
    "combat.dr_mods.feet": "GUM.ConditionBuilder.Attributes.combat_dr_mods_feet",
    "combat.dr_mods.eyes": "GUM.ConditionBuilder.Attributes.combat_dr_mods_eyes",
    "attributes.st.final": "GUM.ConditionBuilder.Attributes.attributes_st_final",
    "attributes.dx.final": "GUM.ConditionBuilder.Attributes.attributes_dx_final",
    "attributes.iq.final": "GUM.ConditionBuilder.Attributes.attributes_iq_final",
    "attributes.ht.final": "GUM.ConditionBuilder.Attributes.attributes_ht_final",
    "attributes.vont.final": "GUM.ConditionBuilder.Attributes.attributes_vont_final",
    "attributes.per.final": "GUM.ConditionBuilder.Attributes.attributes_per_final",
    "encumbrance.level_value": "GUM.ConditionBuilder.Attributes.encumbrance_level_value",
    "encumbrance.penalty": "GUM.ConditionBuilder.Attributes.encumbrance_penalty"
};
const OPERATOR_LABEL_KEYS = {
    "==": "GUM.ConditionBuilder.Operators.Equal",
    "!=": "GUM.ConditionBuilder.Operators.NotEqual",
    "<": "GUM.ConditionBuilder.Operators.LessThan",
    "<=": "GUM.ConditionBuilder.Operators.LessThanOrEqual",
    ">": "GUM.ConditionBuilder.Operators.GreaterThan",
    ">=": "GUM.ConditionBuilder.Operators.GreaterThanOrEqual"
};

const STRUCTURE_GROUPS = [
    {
        labelKey: "GUM.ConditionBuilder.Structures.GeneralCharacter",
        options: {
            attr_check: { labelKey: "GUM.ConditionBuilder.Structures.CheckAttribute", value: "CAMINHO_DO_ATRIBUTO <= VALOR_OU_FÓRMULA" }
        }
    },
    {
        labelKey: "GUM.ConditionBuilder.Structures.ItemsEquipment",
        options: {
            item_name: { labelKey: "GUM.ConditionBuilder.Structures.CheckItemByName", value: "actor.items.some(i => i.name === 'NOME_DO_ITEM')" },
            item_prop: { labelKey: "GUM.ConditionBuilder.Structures.CheckEquippedItem", value: "actor.items.some(i => i.type === 'TIPO' && i.system.location === 'equipped' && i.system.PROPRIEDADE === 'VALOR')" },
            armor_dr: { labelKey: "GUM.ConditionBuilder.Structures.CheckEquippedArmorDR", value: "actor.items.some(i => i.type === 'armor' && i.system.location === 'equipped' && i.system.dr >= VALOR)" }
        }
    },
    {
        labelKey: "GUM.ConditionBuilder.Structures.AdvantagesDisadvantages",
        options: {
            has_adv: { labelKey: "GUM.ConditionBuilder.Structures.CheckAdvantageByName", value: "actor.items.some(i => i.type === 'advantage' && i.name === 'NOME_DA_VANTAGEM')" },
            adv_level: { labelKey: "GUM.ConditionBuilder.Structures.CheckAdvantageLevel", value: "(actor.items.find(i => i.type === 'advantage' && i.name === 'NOME_DA_VANTAGEM')?.system.level || 0) >= NÍVEL" },
            has_disadv: { labelKey: "GUM.ConditionBuilder.Structures.CheckDisadvantageByName", value: "actor.items.some(i => i.type === 'disadvantage' && i.name === 'NOME_DA_DESVANTAGEM')" }
        }
    },
    {
        labelKey: "GUM.ConditionBuilder.Structures.Abilities",
        options: {
            has_ability: {
                labelKey: "GUM.ConditionBuilder.Structures.CheckKnownAbility",
                picker: {
                    titleKey: "GUM.ConditionBuilder.SelectAbilityType",
                    options: {
                        skill: "GUM.ConditionBuilder.AbilityTypes.Skill",
                        spell: "GUM.ConditionBuilder.AbilityTypes.Spell",
                        power: "GUM.ConditionBuilder.AbilityTypes.Power"
                    },
                    template: "actor.items.some(i => i.type === 'TYPE' && i.name === 'NOME_DA_HABILIDADE')"
                }
            },
            ability_level: {
                labelKey: "GUM.ConditionBuilder.Structures.CheckAbilityLevel",
                picker: {
                    titleKey: "GUM.ConditionBuilder.SelectAbilityType",
                    options: {
                        skill: "GUM.ConditionBuilder.AbilityTypes.Skill",
                        spell: "GUM.ConditionBuilder.AbilityTypes.Spell",
                        power: "GUM.ConditionBuilder.AbilityTypes.Power"
                    },
                    template: "(actor.items.find(i => i.type === 'TYPE' && i.name === 'NOME_DA_HABILIDADE')?.system.final_nh || 0) >= NÍVEL"
                }
            }
        }
    },
    {
        labelKey: "GUM.ConditionBuilder.Structures.StatusGameState",
        options: {
            status_check: { labelKey: "GUM.ConditionBuilder.Structures.CheckTokenStatus", value: "actor.effects.some(e => e.getFlag('core', 'statusId') === 'prone')" },
            flag_check: { labelKey: "GUM.ConditionBuilder.Structures.CheckActorFlag", value: "actor.getFlag('gum', 'NOME_DA_FLAG') === true" }
        }
    },
    {
        labelKey: "GUM.ConditionBuilder.Structures.CombatEnvironment",
        options: {
            scene_flag_check: { labelKey: "GUM.ConditionBuilder.Structures.CheckSceneFlag", value: "game.scenes.current.getFlag('gum', 'NOME_DA_FLAG') === true" },
            is_turn: { labelKey: "GUM.ConditionBuilder.Structures.AtStartOfTurn", value: "game.combat && game.combat.started && game.combat.combatant.actorId === actor.id" },
            combat_round: { labelKey: "GUM.ConditionBuilder.Structures.FromCombatRound", value: "game.combat?.round >= NÚMERO_DA_RODADA" }
        }
    }
];

export class ConditionBuilder extends FormApplication {

    constructor(item, options = {}) {
        super(item, options);
        this.item = item;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: localize("GUM.ConditionBuilder.Title"),
            classes: ["gum", "condition-builder", "theme-dark"],
            template: "systems/gum/templates/apps/condition-builder.hbs",
            width: 700,
            height: "320",
            resizable: true
        });
    }

    async getData() {
        const context = await super.getData();
        context.item = this.item;
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.palette-button').on('click', this._onPaletteClick.bind(this));
    }

    // --- MÉTODOS DA PALETA DE FERRAMENTAS ---

    _onPaletteClick(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        const textarea = this.element.find('textarea[name="system.when"]')[0];

        switch(action) {
            // ✅ ROTA ATUALIZADA PARA CHAMAR A FUNÇÃO CORRETA
            case 'open-saved-triggers':
                new TriggerBrowser(textarea).render(true);
                break;
            case 'open-structures':
                this._openStructurePicker(textarea);
                break;
            case 'open-attributes':
                this._openPicker("GUM.ConditionBuilder.SelectAttribute", GUM_DATA.attributes, "actor.system.", textarea, key => ATTRIBUTE_LABEL_KEYS[key]);
                break;
            case 'open-operators':
                this._openPicker("GUM.ConditionBuilder.SelectComparisonOperator", GUM_DATA.operators, "", textarea, key => OPERATOR_LABEL_KEYS[key]);
                break;
            case 'open-connectors':
                const connectors = {
                    " && ": "GUM.ConditionBuilder.Connectors.And",
                    " || ": "GUM.ConditionBuilder.Connectors.Or"
                };
                this._openPicker("GUM.ConditionBuilder.SelectLogicalConnector", connectors, "", textarea);
                break;
        }
    }



    // AGORA SIMPLIFICADA PARA CUIDAR APENAS DAS ESTRUTURAS PADRÃO
    _openStructurePicker(textarea) {
        let content = `<div class="structure-picker-dialog">`;
        for (const group of STRUCTURE_GROUPS) {
            content += `<details class="category"><summary>${escapeHtml(localize(group.labelKey))}</summary><div class="options">`;
            for (const [key, data] of Object.entries(group.options)) {
                content += `<a data-key="${escapeHtml(key)}" title="${escapeHtml(data.value || data.picker.template)}">${escapeHtml(localize(data.labelKey))}</a>`;
            }
            content += `</div></details>`;
        }
        content += `</div>`;

        const d = new Dialog({
            title: localize("GUM.ConditionBuilder.SelectRuleStructure"),
            content,
            buttons: { close: { label: localize("GUM.Common.Close") } },
            render: (html) => {
                html.find('.options a').on('click', (ev) => {
                    const key = ev.currentTarget.dataset.key;
                    let structureData;
                    for (const group of STRUCTURE_GROUPS) {
                        if (group.options[key]) {
                            structureData = group.options[key];
                            break;
                        }
                    }
                    if (!structureData) return;
                    d.close();
                    if (structureData.value) {
                        const placeholder = structureData.value.match(/[A-Z_]+/)?.[0];
                        this._insertTextWithHighlight(textarea, structureData.value, placeholder);
                    } else if (structureData.picker) {
                        this._openTypePicker(structureData.picker, textarea);
                    }
                });
            }
        }, { width: 450, classes: ["dialog", "gum", "structure-picker-dialog"] }).render(true);
    }
    
    _openTypePicker(pickerData, textarea) {
        let content = `<div class="parameter-assistant"><div class="buttons">`;
        for (const [key, labelKey] of Object.entries(pickerData.options)) {
            content += `<button type="button" class="param-button" data-type="${escapeHtml(key)}">${escapeHtml(localize(labelKey))}</button>`;
        }
        content += `</div></div>`;

        const d = new Dialog({
            title: localize(pickerData.titleKey),
            content: content,
            buttons: {},
            render: (html) => {
                html.find('.param-button').on('click', (ev) => {
                    const type = ev.currentTarget.dataset.type;
                    let value = pickerData.template.replace("'TYPE'", `'${type}'`);
                    const placeholder = value.match(/[A-Z_]+/)?.[0];
                    this._insertTextWithHighlight(textarea, value, placeholder);
                    d.close();
                });
            }
        }, { classes: ["dialog", "gum"] }).render(true);
    }

    _openPicker(titleKey, items, valuePrefix = "", textarea, labelKeyFor = null) {
        let content = `<div class="parameter-assistant"><div class="buttons">`;
        for (const [key, label] of Object.entries(items)) {
            const value = `${valuePrefix}${key}`;
            const resolvedLabel = labelKeyFor ? localize(labelKeyFor(key)) : (String(label).startsWith("GUM.") ? localize(label) : label);
            content += `<button type="button" class="param-button" data-value="${escapeHtml(value)}">${escapeHtml(resolvedLabel)}</button>`;
        }
        content += `</div></div>`;

        const d = new Dialog({
            title: localize(titleKey), content, buttons: {},
            render: (html) => {
                html.find('.param-button').on('click', (ev) => {
                    this._insertTextWithHighlight(textarea, ` ${ev.currentTarget.dataset.value} `);
                    d.close();
                });
            }
        }, { width: 500, classes: ["dialog", "gum"] }).render(true);
    }

    _insertTextWithHighlight(textarea, text, placeholder = null) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        
        if (placeholder) {
            const selectStart = textarea.value.indexOf(placeholder, start);
            if (selectStart !== -1) {
                textarea.focus();
                textarea.setSelectionRange(selectStart, selectStart + placeholder.length);
            }
        } else {
            const newCursorPos = start + text.length;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
    }

    async _updateObject(event, formData) {
        await this.item.update({ "system.when": formData["system.when"] });
    }
}