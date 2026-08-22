import { createSingleRollRequestMessage } from "../module/services/roll-request-service.js";
import { normalizeChatRoll } from "../module/utils/roll-request-data.mjs";

/**
 * O "Motor de Efeitos" central do sistema. (Versão 5.0 - Rollback Controlado)
 * Lida com tipos de efeitos separados:
 * - 'attribute'/'flag'/'roll_modifier': Cria ActiveEffects para mecânica e duração.
 * - 'status': Usa toggleStatusEffect para controlar ícones no token.
 * - 'resource_change', 'macro', 'chat': Executam ações pontuais.
 */

import {
    normalizeEffectValueMode,
    resolveEffectValueMetadata
} from "../module/utils/effect-value-scaling.mjs";

const normalizeLookupKey = (value) => value
    ?.toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const getActiveEffectChangeType = (operation) => {
    return operation === "OVERRIDE" ? "override" : "add";
};

const buildActiveEffectChange = ({ key, operation, value }) => {
    const change = {
        key,
        value
    };
    if (CONST.ACTIVE_EFFECT_CHANGE_TYPES) {
        change.type = getActiveEffectChangeType(operation);
    } else {
        change.mode = operation === "OVERRIDE" ? CONST.ACTIVE_EFFECT_MODES.OVERRIDE : CONST.ACTIVE_EFFECT_MODES.ADD;
    }
    return change;
};

const resolveRollBaseValue = (actor, rollAttribute) => {
    if (!actor || !rollAttribute) return null;
    const normalizedKey = normalizeLookupKey(rollAttribute);
    if (!normalizedKey) return null;

    const attributes = actor.system?.attributes || {};
    const attrKey = Object.keys(attributes).find((key) => normalizeLookupKey(key) === normalizedKey);
    if (attrKey) {
        const attr = attributes[attrKey];
        const value = (attr?.override !== null && attr?.override !== undefined)
            ? attr?.override
            : (attr?.final ?? attr?.value);
        if (value !== undefined && value !== null && !Number.isNaN(Number(value))) {
            return Number(value);
        }
    }

    const skills = actor.items?.filter((item) => item.type === "skill") || [];
    const matchedSkill = skills.find((skill) => normalizeLookupKey(skill.name) === normalizedKey);
    if (matchedSkill) {
        const nhValue = matchedSkill.system?.final_nh;
        if (nhValue !== undefined && nhValue !== null && !Number.isNaN(Number(nhValue))) {
            return Number(nhValue);
        }
    }

    if (!Number.isNaN(parseInt(rollAttribute))) return parseInt(rollAttribute);
    return null;
};

const evaluateNumericModifier = (rawValue, { actor = null, gameRef = game } = {}) => {
    if (rawValue === null || rawValue === undefined) return 0;
    if (typeof rawValue === "number") return Number.isFinite(rawValue) ? rawValue : 0;
    const source = String(rawValue).trim();
    if (!source) return 0;
    if (/^[+-]?\d+(\.\d+)?$/.test(source)) return Number(source) || 0;

    try {
        const evaluated = Function("actor", "game", `return (${source});`)(actor, gameRef);
        const numeric = Number(evaluated);
        return Number.isFinite(numeric) ? numeric : 0;
    } catch (error) {
        console.warn("GUM | Falha ao avaliar modificador numérico de chat:", error);
        return 0;
    }
};


const isEffectDurationPermanent = (duration = {}) => {
    if (!duration || typeof duration !== "object") return false;
    if (duration._uiMode === "permanent") return true;
    return duration.isPermanent === true;
};

const normalizeEffectDurationFlags = (duration = {}) => {
    const normalized = foundry.utils.duplicate(duration || {});
    if (isEffectDurationPermanent(normalized)) {
        normalized.isPermanent = true;
        normalized.inCombat = false;
        normalized._uiMode = "permanent";
    }
    return normalized;
};

const normalizeTokenIconPolicy = (value) => {
    const normalized = (value ?? "").toString().trim().toLowerCase();

    if (["always", "always_show", "show", "on", "true", "1", "sempre"].includes(normalized)) return "always";
    if (["never", "never_show", "hide", "off", "false", "0", "nunca"].includes(normalized)) return "never";
    if (["auto", "automatic", "automático", "automatico", "default", "padrão", "padrao"].includes(normalized)) return "auto";

    return "auto";
};

const shouldShowTokenIcon = (effectSystem = {}, duration = {}) => {
    const policy = normalizeTokenIconPolicy(effectSystem.tokenIconPolicy);
    if (policy === "always") return true;
    if (policy === "never") return false;
    return !isEffectDurationPermanent(duration);
};

const getActiveEffectShowIconMode = (effectSystem = {}, duration = {}) => {
    return shouldShowTokenIcon(effectSystem, duration) ? 2 : 0;
};


const resolveTokenIconImage = (effectItem, effectSystem = {}, duration = {}) => {
    if (!shouldShowTokenIcon(effectSystem, duration)) return null;
    return effectItem?.img ?? null;
};


const applyFoundryRollModePrivacy = (chatData, rollMode = game?.settings?.get?.("core", "rollMode")) => {
    const mode = rollMode || "publicroll";
    if (mode === "gmroll") {
        chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    } else if (mode === "blindroll") {
        chatData.whisper = ChatMessage.getWhisperRecipients("GM");
        chatData.blind = true;
    } else if (mode === "selfroll") {
        chatData.whisper = [game.user.id];
    }
    return chatData;
};

const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const DEFAULT_EFFECT_ACTION = {
    label: "",
    type: "attribute",
    path: "system.attributes.st.passive",
    operation: "ADD",
    value: "1",
    key: "",
    flag_value: "",
    chat_text: "",
    has_roll: false,
    roll_label: "Rolar Teste",
    roll_attribute: "ht",
    roll_modifier: "0",
    roll_modifier_value: "0",
    roll_modifier_cap: "",
    roll_modifier_context: "all",
    roll_modifier_source_item_ids: "",
    roll_modifier_source_attack_ids: "",
    roll_modifier_entries: [],
    whisperMode: "public",
    category: "hp",
    name: "",
    chat_notice: true,
    confirm_prompt: false,
    variable_value: false,
    max: "0",
    source: "",
    hidden: false,
    exists_policy: "ignore",
    statusId: "dead"
};

// Regra explícita de prioridade do ícone carrier.
// Menor número = maior prioridade.
const CARRIER_ACTION_PRIORITY = {
    attribute: 1,
    roll_modifier: 2,
    flag: 3,
    status: 4
};

const normalizeRollModifierEntryValue = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    if (/^[+-]?\d+(\.\d+)?$/.test(raw)) {
        const asNumber = Number(raw);
        return Number.isFinite(asNumber) ? asNumber : 0;
    }
    return raw;
};

const normalizeRollModifierApplicationSide = (value) => {
    const raw = (value ?? "self").toString().trim().toLowerCase();
    if (["vs_targeter", "vs_target", "target", "against_targeter"].includes(raw)) return "vs_targeter";
    return "self";
};

const normalizeEffectAction = (action = {}) => {
    const next = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_EFFECT_ACTION), action || {}, { inplace: false, overwrite: true });
    if (!Array.isArray(next.roll_modifier_entries) || next.roll_modifier_entries.length === 0) {
        next.roll_modifier_entries = [{
            label: "",
            value: normalizeRollModifierEntryValue(next.roll_modifier_value),
            value_mode: normalizeEffectValueMode(next.roll_modifier_value_mode ?? next.value_mode),
            cap: next.roll_modifier_cap ?? "",
            contexts: next.roll_modifier_context ?? "all",
            application_side: normalizeRollModifierApplicationSide(next.roll_modifier_application_side),
            target_kind: (next.roll_modifier_target_kind || "any").toString().trim() || "any",
            target_mode: (next.roll_modifier_target_mode || "all").toString().trim() || "all",
            target_values: (next.roll_modifier_target_values || "").toString().trim(),
            source_item_ids: (next.roll_modifier_source_item_ids || "").toString().trim(),
            source_attack_ids: (next.roll_modifier_source_attack_ids || "").toString().trim(),
            roll_tags: (next.roll_modifier_roll_tags || "").toString().trim(),
            roll_tag_match: next.roll_modifier_roll_tag_match === "all" ? "all" : "any",
            nh_display_mode: (next.roll_modifier_nh_display_mode || "roll_only").toString().trim() || "roll_only"
        }];
    }
    next.roll_modifier_entries = next.roll_modifier_entries.map((entry) => ({
        label: (entry?.label || "").toString().trim(),
        value: normalizeRollModifierEntryValue(entry?.value),
        value_mode: normalizeEffectValueMode(entry?.value_mode),
        cap: (entry?.cap ?? entry?.nh_cap ?? "").toString().trim(),
        contexts: (entry?.contexts || "all").toString().trim() || "all",
        application_side: normalizeRollModifierApplicationSide(entry?.application_side ?? entry?.applicationSide ?? next.roll_modifier_application_side),
        target_kind: (entry?.target_kind || "any").toString().trim() || "any",
        target_mode: (entry?.target_mode || "all").toString().trim() || "all",
        target_values: (entry?.target_values || "").toString().trim(),
        source_item_ids: (entry?.source_item_ids || "").toString().trim(),
        source_attack_ids: (entry?.source_attack_ids || "").toString().trim(),
         roll_tags: Array.isArray(entry?.roll_tags) ? entry.roll_tags.join(",") : (entry?.roll_tags || "").toString().trim(),
        roll_tag_match: entry?.roll_tag_match === "all" ? "all" : "any",
        nh_display_mode: (entry?.roll_tags?.length || String(entry?.roll_tags || "").trim()) ? "roll_only" : (entry?.nh_display_mode || "roll_only").toString().trim() || "roll_only"
    }));
    next.roll_modifier_value = next.roll_modifier_entries[0]?.value ?? 0;
    next.roll_modifier_cap = next.roll_modifier_entries[0]?.cap ?? "";
    next.roll_modifier_source_item_ids = next.roll_modifier_entries[0]?.source_item_ids ?? "";
    next.roll_modifier_source_attack_ids = next.roll_modifier_entries[0]?.source_attack_ids ?? "";
    next.roll_modifier_application_side = next.roll_modifier_entries[0]?.application_side ?? "self";
    return next;
};

const buildFallbackActionLabel = (action = {}) => {
    switch (action.type) {
        case "attribute":
            return "Modificador de Atributo";
        case "roll_modifier":
            return "Modificador de Rolagem";
        case "status":
            return `Status: ${action.statusId || "indefinido"}`;
        case "resource_change":
            return "Alteração de Recurso";
        case "resource_create":
            return "Criar Recurso";
        case "flag":
            return "Flag";
        case "macro":
            return "Macro";
        case "chat":
            return "Mensagem de Chat";
        default:
            return "Ação";
    }
};

export const getEffectActions = (effectSystem = {}) => {
    if (Array.isArray(effectSystem?.actions)) return effectSystem.actions.map(normalizeEffectAction);
    return [normalizeEffectAction(effectSystem)];
};

const selectCarrierActionIndex = (actions = []) => {
    const persistent = actions
        .map((action, index) => ({ action, index }))
        .filter(({ action }) => ["attribute", "flag", "roll_modifier", "status"].includes(action.type));
    if (!persistent.length) return null;

    persistent.sort((a, b) => {
        const pa = CARRIER_ACTION_PRIORITY[a.action.type] ?? 9999;
        const pb = CARRIER_ACTION_PRIORITY[b.action.type] ?? 9999;
        if (pa !== pb) return pa - pb;
        return a.index - b.index;
    });
    return persistent[0].index;
};

export async function applySingleEffect(effectItem, targets, context = {}) {
    if (!effectItem || targets.length === 0) return;

    const effectSystem = effectItem.system;
    const actions = getEffectActions(effectSystem);
    if (!actions.length) return;
    const conditionFlags = context.conditionId
        ? { conditionEffect: true, conditionId: context.conditionId, conditionIds: [context.conditionId] }
        : {};
    const uniqueAcrossConditions = context.conditionId && effectSystem.conditionStackingMode === "unique";
    const evaluateEffectValue = async (value, actor) => {
        if (typeof value !== "string") {
            return { value, roll: null, formula: null };
        }

        const trimmed = value.trim();
        if (trimmed === "") {
            return { value: 0, roll: null, formula: null };
        }

        // ✅ Suporte a notação de dados com sinal, ex: 1d6, -1d6, 2d4+1.
        try {
            const roll = new Roll(trimmed, actor?.getRollData?.() || {});
            await roll.evaluate();
            return { value: roll.total, roll, formula: trimmed };
        } catch (rollError) {
            // Fallback para expressões JS legadas.
            try {
                return { value: new Function("actor", "game", `return (${trimmed});`)(actor, game), roll: null, formula: null };
            } catch (error) {
                console.warn(`GUM | Não foi possível avaliar o valor do efeito "${effectItem.name}":`, error);
                return { value, roll: null, formula: null };
            }
        }
    };
    const persistentTypes = new Set(["attribute", "flag", "roll_modifier", "status"]);
    const instantTypes = new Set(["resource_change", "resource_create", "macro", "chat"]);

    const buildCommonActiveEffectData = (targetActor, actionIndex = 0) => {
        const gumDuration = normalizeEffectDurationFlags(effectSystem.duration || {});
        const startMode = gumDuration.startMode || "apply";
        const endMode = gumDuration.endMode || "turnEnd";
        const shouldDelayStart = gumDuration.inCombat && startMode === "nextTurnStart";
        const pendingCombat = gumDuration.inCombat && !game.combat;
        gumDuration.startMode = startMode;
        gumDuration.endMode = endMode;
        if (shouldDelayStart) gumDuration.pendingStart = true;
        if (pendingCombat) gumDuration.pendingCombat = true;

        const activeEffectData = {
            name: effectItem.name,
            img: null,
            showIcon: 0,
            origin: context.origin ? context.origin.uuid : (context.actor ? context.actor.uuid : null),
            changes: [],
            statuses: [],
            flags: {
                gum: {
                    effectUuid: effectItem.uuid,
                    source: context.source || null,
                    originItemId: context.originItemId ?? null,
                    conditionActivationMode: context.conditionActivationMode ?? null,
                    statusBindingRuleUuid: context.statusBindingRuleUuid ?? null,
                    statusBindingStatusId: context.statusBindingStatusId ?? null,
                    duration: gumDuration,
                    ...conditionFlags
                }
            },
            disabled: pendingCombat || shouldDelayStart
        };

 if (!isEffectDurationPermanent(gumDuration)) {
            activeEffectData.duration = {};
            const value = parseInt(gumDuration.value) || 1;
            const unit = gumDuration.unit;
            const usesCombatDuration = gumDuration.inCombat && game.combat;
            if (!usesCombatDuration) {
                if (unit === "turns") activeEffectData.duration.turns = value;
                else if (unit === "seconds") activeEffectData.duration.seconds = value;
                else if (unit === "rounds") activeEffectData.duration.rounds = value;
                else if (unit === "minutes") activeEffectData.duration.seconds = value * 60;
                else if (unit === "hours") activeEffectData.duration.seconds = value * 60 * 60;
                else if (unit === "days") activeEffectData.duration.seconds = value * 60 * 60 * 24;
            }

            if (usesCombatDuration) activeEffectData.duration.combat = game.combat.id;
            if (!pendingCombat && !shouldDelayStart) {
                activeEffectData.duration.startRound = game.combat?.round ?? null;
                activeEffectData.duration.startTurn = game.combat?.turn ?? null;
                activeEffectData.duration.startTime = game.time?.worldTime ?? null;
            }
        }

        const fallbackCoreStatusId = `${effectItem.name.slugify({ strict: true })}-a${actionIndex + 1}`;
        return { activeEffectData, targetActor, gumDuration, fallbackCoreStatusId };
    };

    const baseIconCarrierIndex = selectCarrierActionIndex(actions);

    for (const [actionIndex, action] of actions.entries()) {
        if (!persistentTypes.has(action.type) && !instantTypes.has(action.type)) {
            console.warn(`[GUM] Tipo de ação de efeito "${action.type}" não reconhecido.`);
            continue;
        }

        try {
            if (persistentTypes.has(action.type)) {
                if (context.skipPersistentEffects) continue;
                for (const targetToken of targets) {
                    const targetActor = targetToken.actor;
                    if (uniqueAcrossConditions) {
                        const sharedEffect = Array.from(targetActor?.effects || []).find((effect) => {
                            const gumFlags = effect?.flags?.gum || {};
                            return gumFlags.conditionEffect === true
                                && gumFlags.effectUuid === effectItem.uuid
                                && Number(gumFlags.actionIndex ?? 0) === actionIndex;
                        });
                        if (sharedEffect) {
                            const existingConditionIds = Array.isArray(sharedEffect.flags?.gum?.conditionIds)
                                ? sharedEffect.flags.gum.conditionIds
                                : [sharedEffect.flags?.gum?.conditionId].filter(Boolean);
                            const conditionIds = [...new Set([...existingConditionIds, context.conditionId])];
                            if (conditionIds.length !== existingConditionIds.length) {
                                await sharedEffect.update({ "flags.gum.conditionIds": conditionIds });
                            }
                            continue;
                        }
                    }
                    const { activeEffectData, gumDuration, fallbackCoreStatusId } = buildCommonActiveEffectData(targetActor, actionIndex);
                    activeEffectData.name = (action.label || "").trim() || buildFallbackActionLabel(action) || effectItem.name;
                    activeEffectData.flags.gum.actionIndex = actionIndex;
                    activeEffectData.flags.gum.actionType = action.type;
                    activeEffectData.flags.gum.actionLabel = (action.label || "").trim();
                    const isIconCarrier = shouldShowTokenIcon(effectSystem, gumDuration) && baseIconCarrierIndex === actionIndex;
                    if (isIconCarrier) {
                        activeEffectData.img = resolveTokenIconImage(effectItem, effectSystem, gumDuration);
                        activeEffectData.showIcon = getActiveEffectShowIconMode(effectSystem, gumDuration);
                    }

                    if (action.type === "attribute") {
                        if (!action.path) throw new Error("Ação de atributo sem caminho.");
                        const { value: computedValue, roll, formula } = await evaluateEffectValue(action.value, targetActor);
                        const resolvedValue = resolveEffectValueMetadata(computedValue, action.value_mode, context.origin);
                        activeEffectData.changes.push(buildActiveEffectChange({
                            key: action.path,
                            operation: action.operation,
                            value: resolvedValue.effectiveValue                            
                        }));
                        activeEffectData.flags.gum.valueScaling = resolvedValue;
                        if (roll) {
                            await roll.toMessage({
                                speaker: ChatMessage.getSpeaker({ actor: targetActor }),
                                flavor: `${effectItem.name} • ${action.label || "Modificador de Atributo"} (${formula})`
                            });
                        }
                    }

                    if (action.type === "flag") {
                        if (!action.key) throw new Error("Ação de flag sem chave.");
                        const valueToSet = action.flag_value === "true" ? true : action.flag_value === "false" ? false : action.flag_value;
                        foundry.utils.setProperty(activeEffectData.flags, `gum.${action.key}`, valueToSet);
                    }

                    if (action.type === "roll_modifier") {
                    const canonicalEntries = Array.isArray(action.roll_modifier_entries) && action.roll_modifier_entries.length
                            ? action.roll_modifier_entries
                            : [{
                                value: action.roll_modifier_value ?? 0,
                                value_mode: action.roll_modifier_value_mode ?? action.value_mode,
                                cap: action.roll_modifier_cap ?? "",
                                contexts: action.roll_modifier_context ?? "all",
                                application_side: action.roll_modifier_application_side ?? "self",
                                target_kind: action.roll_modifier_target_kind ?? "any",
                                target_mode: action.roll_modifier_target_mode ?? "all",
                                target_values: action.roll_modifier_target_values ?? "",
                                source_item_ids: action.roll_modifier_source_item_ids ?? "",
                                source_attack_ids: action.roll_modifier_source_attack_ids ?? "",
                                roll_tags: action.roll_modifier_roll_tags ?? "",
                                roll_tag_match: action.roll_modifier_roll_tag_match ?? "any",
                                nh_display_mode: action.roll_modifier_nh_display_mode ?? "roll_only"
                            }];
                        const entries = canonicalEntries.map((entry) => {
                            const scaling = resolveEffectValueMetadata(entry.value, entry.value_mode, context.origin);
                            return {
                                ...foundry.utils.deepClone(entry),
                                value: scaling.effectiveValue,
                                value_mode: scaling.valueMode,
                                base_value: scaling.baseValue,
                                origin_level: scaling.originLevel,
                                origin_item_id: scaling.originItemId,
                                origin_item_uuid: scaling.originItemUuid
                            };
                        });
                        activeEffectData.flags.gum.rollModifier = {
                            entries,
                            value: entries[0]?.value ?? 0,
                            cap: entries[0]?.cap ?? "",
                            context: entries[0]?.contexts ?? "all",
                            applicationSide: entries[0]?.application_side ?? "self"
                        };
                    }

                    if (isIconCarrier && action.type !== "status") {
                        activeEffectData.statuses.push(fallbackCoreStatusId);
                        foundry.utils.setProperty(activeEffectData, "flags.core.statusId", fallbackCoreStatusId);
                    }
                    if (action.type === "status" && action.statusId) {
                        const statusEffect = (CONFIG.statusEffects || []).find((status) => status.id === action.statusId);
                        activeEffectData.img = statusEffect?.icon ?? statusEffect?.img ?? activeEffectData.img;
                        activeEffectData.showIcon = getActiveEffectShowIconMode(effectSystem, gumDuration);
                        activeEffectData.statuses.push(action.statusId);
                        foundry.utils.setProperty(activeEffectData, "flags.core.statusId", action.statusId);
                    }
                    if (effectSystem.attachedStatusId && isIconCarrier && action.type !== "status") {
                        activeEffectData.statuses.push(effectSystem.attachedStatusId);
                    }
                    activeEffectData.statuses = [...new Set(activeEffectData.statuses.filter(Boolean))];

                    await targetActor.createEmbeddedDocuments("ActiveEffect", [activeEffectData]);
                    targetActor.sheet.render(false);
                }
                continue;
            }

            if (action.type === "resource_change") {
                let valueToChange = action.value;

                if (action.confirm_prompt) {
                    const confirmed = await Dialog.confirm({
                        title: "Confirmar Alteração de Recurso",
                        content: `<div class="gum-resource-change-dialog__content"><p>Deseja aplicar o efeito <strong>"${escapeHtml(effectItem.name)}"</strong>?</p></div>`,
                        yes: () => true,
                        no: () => false,
                        defaultYes: true,
                        options: {
                            classes: ["dialog", "gum", "gum-dialog", "gum-resource-change-dialog"]
                        }
                    });
                    if (!confirmed) continue;
                }
                if (action.variable_value) {
                    const newAmount = await new Promise(resolve => {
                        new Dialog({
                            title: "Definir Alteração de Recurso",
                            content: `
                                <div class="gum-resource-change-dialog__content">
                                    <p class="gum-resource-change-dialog__prompt">Qual o valor para <strong>"${escapeHtml(effectItem.name)}"</strong>?</p>
                                    <div class="gum-resource-change-dialog__field">
                                        <label for="gum-resource-change-amount">Valor</label>
                                        <input id="gum-resource-change-amount" type="text" name="amount" value="${escapeHtml(valueToChange)}" autocomplete="off"/>
                                    </div>
                                </div>
                            `,
                            buttons: { apply: { icon: '<i class="fas fa-check"></i>', label: "Aplicar", callback: (html) => resolve(html.find('input[name=\"amount\"]').val()) } },
                            default: "apply",
                            close: () => resolve(null)
                        }, {
                            classes: ["dialog", "gum", "gum-dialog", "gum-resource-change-dialog"],
                            width: 380
                        }).render(true);
                    });
                    if (newAmount === null) continue;
                    valueToChange = newAmount;
                }

                const roll = new Roll(String(valueToChange));
                await roll.evaluate();
                const finalValue = roll.total;

                for (const targetToken of targets) {
                    const targetActor = targetToken.actor;
                    let updatePath = "";
                    let updateObject = null;

                    switch (action.category) {
                        case "hp": updatePath = "system.attributes.hp.value"; break;
                        case "fp": updatePath = "system.attributes.fp.value"; break;
                        case "energy_reserve": {
                            const reserveKey = Object.keys(targetActor.system.spell_reserves || {}).find(k => targetActor.system.spell_reserves[k].name === action.name) || Object.keys(targetActor.system.power_reserves || {}).find(k => targetActor.system.power_reserves[k].name === action.name);
                            if (reserveKey) updatePath = targetActor.system.spell_reserves[reserveKey] ? `system.spell_reserves.${reserveKey}.current` : `system.power_reserves.${reserveKey}.current`;
                            break;
                        }
                        case "combat_tracker": {
                            const trackerKey = Object.keys(targetActor.system.combat.combat_meters || {}).find(k => targetActor.system.combat.combat_meters[k].name === action.name);
                            if (trackerKey) updatePath = `system.combat.combat_meters.${trackerKey}.current`;
                            break;
                        }
                        case "item_quantity": {
                            const itemToUpdate = targetActor.items.find(i => i.name === action.name);
                            if (itemToUpdate) {
                                const newQuantity = (itemToUpdate.system.quantity || 0) + finalValue;
                                updateObject = itemToUpdate.update({ "system.quantity": newQuantity });
                            }
                            break;
                        }
                        default:
                            break;
                    }

                    if (updateObject) await updateObject;
                    else if (updatePath) {
                        const currentValue = foundry.utils.getProperty(targetActor, updatePath) || 0;
                        await targetActor.update({ [updatePath]: currentValue + finalValue });
                    }
                    if (action.chat_notice) {
                        const chatData = applyFoundryRollModePrivacy({
                            speaker: ChatMessage.getSpeaker({ actor: targetActor }),
                            content: `<strong>${escapeHtml(effectItem.name)}:</strong> ${finalValue >= 0 ? "+" : ""}${finalValue} aplicado em ${escapeHtml(action.name || action.category)}.`
                        });
                        ChatMessage.create(chatData);
                    }
                }
                continue;
            }

             if (action.type === "resource_create") {
                const resourceName = (action.name || "").toString().trim();
                if (!resourceName) {
                    ui.notifications.warn(`[GUM] Ação Criar Recurso de "${effectItem.name}" sem nome definido.`);
                    continue;
                }

                const existsPolicy = action.exists_policy || "ignore";

                for (const targetToken of targets) {
                    const targetActor = targetToken.actor;
                    const { value: initialValue } = await evaluateEffectValue(action.value ?? 0, targetActor);
                    const { value: maxValue } = await evaluateEffectValue(action.max ?? action.value ?? 0, targetActor);
                    const current = Number(initialValue) || 0;
                    const max = Number(maxValue) || 0;
                    let collectionPath = null;
                    const resourceData = { name: resourceName, current, max, value: current };

                    if (action.category === "spell_reserve") {
                        collectionPath = "system.spell_reserves";
                        resourceData.source = action.source || effectItem.name;
                    } else if (action.category === "power_reserve") {
                        collectionPath = "system.power_reserves";
                        resourceData.source = action.source || effectItem.name;
                    } else if (action.category === "combat_tracker") {
                        collectionPath = "system.combat.combat_meters";
                        resourceData.hidden = Boolean(action.hidden);
                    }

                    if (!collectionPath) {
                        ui.notifications.warn(`[GUM] Categoria de criação de recurso "${action.category}" não reconhecida.`);
                        continue;
                    }

                    const collection = foundry.utils.getProperty(targetActor, collectionPath) || {};
                    const existingEntry = Object.entries(collection).find(([, entry]) => entry?.name === resourceName);
                    if (existingEntry) {
                        const [existingKey, existing] = existingEntry;
                        const basePath = `${collectionPath}.${existingKey}`;
                        if (existsPolicy === "ignore") {
                            if (action.chat_notice) {
                                ChatMessage.create(applyFoundryRollModePrivacy({
                                    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
                                    content: `<strong>${escapeHtml(effectItem.name)}:</strong> ${escapeHtml(resourceName)} já existe e foi mantido.`
                                }));
                            }
                            continue;
                        }
                        if (existsPolicy === "replace") {
                            await targetActor.update({ [basePath]: resourceData });
                        } else if (existsPolicy === "sum_max") {
                            const nextMax = (Number(existing.max ?? existing.value ?? 0) || 0) + max;
                            await targetActor.update({ [`${basePath}.max`]: nextMax });
                        } else if (existsPolicy === "update_max") {
                            await targetActor.update({ [`${basePath}.max`]: max });
                        } else if (existsPolicy === "restore") {
                            const resolvedMax = Number(existing.max ?? max) || max;
                            await targetActor.update({ [`${basePath}.current`]: resolvedMax, [`${basePath}.value`]: resolvedMax });
                        }
                    } else {
                        await targetActor.update({ [`${collectionPath}.${foundry.utils.randomID()}`]: resourceData });
                    }

                    if (action.chat_notice) {
                        ChatMessage.create(applyFoundryRollModePrivacy({
                            speaker: ChatMessage.getSpeaker({ actor: targetActor }),
                            content: `<strong>${escapeHtml(effectItem.name)}:</strong> recurso ${escapeHtml(resourceName)} criado/atualizado (${current}/${max}).`
                        }));
                    }
                }
                continue;
            }

            if (action.type === "macro") {
                if (!action.value) continue;
                const macro = game.macros.getName(action.value);
                if (macro) macro.execute({ actor: context.actor, origin: context.origin, targets });
                else ui.notifications.warn(`[GUM] Macro "${action.value}" não encontrada.`);
                continue;
            }

            if (action.type === "chat") {
                if (!action.chat_text) continue;
                for (const target of targets) {
                    const targetActor = target.actor;
                    const chatBody = action.chat_text.replace(/{actor.name}/g, targetActor.name);
                    const content = `<div class="gurps-effect-chat-card"><div class="gum-effect-chat-header"><i class="fas fa-comment-dots"></i><span>Mensagem de Efeito</span><span class="gum-effect-chat-target">${targetActor.name}</span></div><div class="gum-effect-chat-body">${chatBody}</div></div>`;
                    const chatData = { speaker: ChatMessage.getSpeaker({ actor: targetActor }), content };
                    if (action.whisperMode === "gm") chatData.whisper = ChatMessage.getWhisperRecipients("GM");
                    else if (action.whisperMode === "blind") chatData.blind = true;
                    if (action.has_roll) {
                        const normalized = normalizeChatRoll(action);
                        await createSingleRollRequestMessage({ title: normalized.label, description: chatBody, origin: { type: "effect-chat", effectUuid: effectItem.uuid }, targets: [{ targetKey: targetActor.uuid, actorUuid: targetActor.uuid, tokenUuid: null, actorName: targetActor.name, actorImg: targetActor.img, recipientUserIds: [] }], test: normalized.test, consequence: { type: "chat-record" }, delivery: { rollMode: normalized.whisperMode } }, chatData);
                    } else ChatMessage.create(chatData);
                }
            }
        } catch (error) {
            console.error(`GUM | Falha ao aplicar ação "${action.type}" do efeito "${effectItem.name}":`, error);
            ui.notifications.warn(`Efeito "${effectItem.name}": uma ação "${action.type}" falhou e foi ignorada.`);
        }
    }
}