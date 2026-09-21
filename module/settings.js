// GUM/module/settings.js

/**
 * A FUNÇÃO DE SINCRONIZAÇÃO (V2 - Corrigida)
 */
async function syncCompendiumRules() {
    ui.notifications.info("Iniciando sincronização das Condições Passivas...");

    const { documents: sourceRules, invalidSources } = await contentSourceService.getDocuments("passiveConditions");
    const passiveRules = sourceRules.filter(rule => rule.system?.bindingMode !== "status-link");

    if (passiveRules.length === 0) {
        const missing = invalidSources.map(source => source.id).join(", ");
        return ui.notifications.warn(missing
            ? `Nenhuma condição passiva disponível. Fontes inválidas: ${missing}.`
            : "As fontes configuradas de Condições Passivas estão vazias. Nenhuma regra para sincronizar.");
    }

    let createdCount = 0;
    let updatedCount = 0;
    const actorsToUpdate = game.actors.filter(a => a.type === "character");

    for (const actor of actorsToUpdate) {
        const { updates, creates } = buildPassiveConditionSyncOperations(actor.items, passiveRules);

        if (updates.length > 0) {
            await actor.updateEmbeddedDocuments("Item", updates);
            updatedCount += updates.length;
        }
        if (creates.length > 0) {
            await actor.createEmbeddedDocuments("Item", creates);
            createdCount += creates.length;
        }
    }

    if (invalidSources.length) {
        console.warn("GUM | Fontes de Condições Passivas indisponíveis durante a sincronização:", invalidSources);
    }
    ui.notifications.info(`Sincronização completa: ${createdCount} condições adicionadas e ${updatedCount} atualizadas em ${actorsToUpdate.length} personagens.`);
}

// --- IMPORTA A LÓGICA DOS IMPORTADORES ---
import { importFromJson, importFromGCS, importTemplateFromGCS, exportCompendiumToJson, exportCharacterToJson } from "./apps/importers.js";
import { ContentSourceConfig } from "./apps/content-source-config.js";
import { CONTENT_SOURCE_SETTING, contentSourceService } from "./services/content-source-service.mjs";
import { buildPassiveConditionSyncOperations } from "./utils/passive-condition-sync.mjs";

const STATUS_BINDINGS_MIGRATION_SETTING = "contentSourcesStatusBindingsMigrationV1";
const RETIRED_BUNDLED_SOURCES_MIGRATION_SETTING = "contentSourcesRetiredBundledSourcesMigrationV1";
const RETIRED_BUNDLED_SOURCES = Object.freeze({
    modifiers: "gum.modifiers",
    templates: "gum.templates",
    equipmentModifiers: "gum.eqp_modifiers",
    rollModifiers: "gum.gm_modifiers",
    skills: "gum.skills",
    triggers: "gum.gatilhos"
});

export async function migrateRetiredBundledSources() {
    if (!game.user?.isGM) return false;
    if (game.settings.get("gum", RETIRED_BUNDLED_SOURCES_MIGRATION_SETTING)) return false;

    const configuredSources = contentSourceService.getSettings();
    let changed = false;
    for (const [purpose, retiredId] of Object.entries(RETIRED_BUNDLED_SOURCES)) {
        if (!Object.hasOwn(configuredSources, purpose)) continue;
        const filtered = configuredSources[purpose].filter(id => id !== retiredId);
        if (filtered.length === configuredSources[purpose].length) continue;
        configuredSources[purpose] = filtered;
        changed = true;
    }

    if (changed) await game.settings.set("gum", CONTENT_SOURCE_SETTING, configuredSources);
    await game.settings.set("gum", RETIRED_BUNDLED_SOURCES_MIGRATION_SETTING, true);
    return changed;
}

export async function migrateLegacyStatusBindingSource() {
    if (!game.user?.isGM) return false;
    if (game.settings.get("gum", STATUS_BINDINGS_MIGRATION_SETTING)) return false;

    const configuredSources = contentSourceService.getSettings();
    if (!Object.hasOwn(configuredSources, "statusBindings")) {
        const legacyId = `${game.settings.get("gum", "statusBindingsCompendium") || ""}`.trim();
        await contentSourceService.setSourceIds("statusBindings", [legacyId || "gum.conditions"]);
    }

    await game.settings.set("gum", STATUS_BINDINGS_MIGRATION_SETTING, true);
    return true;
}


// --- REGISTRO DAS CONFIGURAÇÕES ---

export const registerSystemSettings = function() {

    game.settings.register("gum", CONTENT_SOURCE_SETTING, {
        name: "GUM.ContentSources.Title",
        hint: "Configuração interna das bibliotecas utilizadas pelas funções do sistema.",
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register("gum", STATUS_BINDINGS_MIGRATION_SETTING, {
        name: "Migração interna: fontes das Automações de Status",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register("gum", RETIRED_BUNDLED_SOURCES_MIGRATION_SETTING, {
        name: "Migração interna: fontes internas descontinuadas",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.registerMenu("gum", "contentSourceConfig", {
        name: "GUM.ContentSources.Title",
        label: "GUM.ContentSources.Menu.Label",
        hint: "GUM.ContentSources.Menu.Hint",
        icon: "fas fa-books",
        type: ContentSourceConfig,
        restricted: true
    });

 game.settings.register("gum", "effectTokenIconPolicyMigration", {
        name: "Migração interna: Política de ícone de efeito no token",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register("gum", "effectActionsSchemaMigrationV2", {
        name: "Migração interna: Schema de ações do item efeito (v2)",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });
    game.settings.register("gum", "basicDamageSchemaMigrationV1", {
        scope: "world", config: false, type: Boolean, default: false
    });

// --- CONFIGURAÇÃO DE LAYOUT DO ESCUDO DO MESTRE ---
    game.settings.register("gum", "gmScreenConfig", {
        name: "Layout do Escudo",
        scope: "world",
        config: false, // Invisível no menu, gerenciado via código
        type: Object,
        default: {
            groups: []
        }
    });
    
    // --- FÓRMULA DE INICIATIVA CORRIGIDA ---
    game.settings.register("gum", "initiativeFormula", {
        name: "GUM.Settings.InitiativeFormula.Name",
        hint: "GUM.Settings.InitiativeFormula.Hint",
        scope: "world",
        config: true,
        type: String,
        default: "@attributes.basic_speed.final + (@attributes.dx.final/100) + (1d6/1000)",

        
        onChange: value => {
             new Dialog({
                title: game.i18n.localize("GUM.Settings.InitiativeFormula.ReloadTitle"),
                content: `<p>${game.i18n.localize("GUM.Settings.InitiativeFormula.ReloadContent")}</p>`,
                buttons: {
                    reload: { icon: '<i class="fas fa-redo"></i>', label: game.i18n.localize("GUM.Settings.InitiativeFormula.ReloadNow"), callback: () => window.location.reload() },
                    later: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("GUM.Settings.InitiativeFormula.ReloadLater") }
                },
                default: "reload"
            }).render(true);
        }
    });

    // --- CONFIGURAÇÃO DE ADIÇÃO DE REGRAS PADRÃO ---
    game.settings.register("gum", "addDefaultRules", {
        name: "GUM.Settings.AddDefaultRules.Name",
        hint: "GUM.Settings.AddDefaultRules.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

        // --- "BOTÃO" DE ATUALIZAÇÃO ---
    game.settings.register("gum", "syncCompendiumRulesBtn", {
        name: "GUM.Settings.SyncPassiveConditions.Name",
        hint: "GUM.Settings.SyncPassiveConditions.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: async (value) => {
            if (value) {
                console.log("GUM | Sincronização de regras iniciada pelo GM...");
                try {
                    await syncCompendiumRules();
                } catch (error) {
                    console.error("GUM | Falha ao sincronizar Condições Passivas.", error);
                    ui.notifications.error("Não foi possível sincronizar as Condições Passivas. Consulte o console para detalhes.");
                } finally {
                    await game.settings.set("gum", "syncCompendiumRulesBtn", false);
                }
            }
        }
    });

    game.settings.register("gum", "statusBindingsCompendium", {
        name: "GUM.StatusAutomations.LegacySetting.Name",
        hint: "GUM.StatusAutomations.LegacySetting.Hint",
        scope: "world",
        config: false,
        type: String,
        default: "gum.status_bindings"
    });

    game.settings.register("gum", "hybridImportSearchAllCompendia", {
        name: "GUM.Settings.HybridImportSearchAll.Name",
        hint: "GUM.Settings.HybridImportSearchAll.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });



    game.settings.register("gum", "defaultSkillRollFormula", {
        name: "GUM.Settings.DefaultSkillRollFormula.Name",
        hint: "GUM.Settings.DefaultSkillRollFormula.Hint",
        scope: "world",
        config: true,
        type: String,
        default: "3d6"
    });

    game.settings.register("gum", "autoDistanceModifierEnabled", {
        name: "GUM.Settings.AutoDistanceModifier.Name",
        hint: "GUM.Settings.AutoDistanceModifier.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("gum", "autoDistanceModifierTable", {
        name: "GUM.Settings.DistanceTable.Name",
        hint: "GUM.Settings.DistanceTable.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            standard: "GUM.Settings.DistanceTable.Standard",
            monster_hunters: "GUM.Settings.DistanceTable.MonsterHunters",
            hybrid: "GUM.Settings.DistanceTable.Hybrid"
        },
        default: "standard"
    });

        game.settings.register("gum", "autoSizeModifierMode", {
        name: "GUM.Settings.AutoSizeModifier.Name",
        hint: "GUM.Settings.AutoSizeModifier.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            off: "GUM.Settings.AutoSizeModifier.Off",
            target: "GUM.Settings.AutoSizeModifier.Target",
            relative: "GUM.Settings.AutoSizeModifier.Relative"
        },
        default: "off"
    });

    game.settings.register("gum", "normalizeGurpsDamageDice", {
        name: "GUM.Settings.NormalizeDamageDice.Name",
        hint: "GUM.Settings.NormalizeDamageDice.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });



    // =============================================================
    // NOVOS BOTÕES DE IMPORTAÇÃO
    // =============================================================

    game.settings.register("gum", "importGCSButton", {
        name: "GUM.Settings.ImportGCSCharacter.Name",
        hint: "GUM.Settings.ImportGCSCharacter.Hint",
        scope: "world",
        config: true,
        type: Boolean, // Usamos Boolean como um "botão"
        default: false,
        onChange: (value) => {
            if (value) {
                importFromGCS(); // Chama a função do importers.js
                game.settings.set("gum", "importGCSButton", false); // Reseta o botão
            }
        }
    });

    game.settings.register("gum", "importGCSTemplateButton", {
        name: "GUM.Settings.ImportGCSTemplate.Name",
        hint: "GUM.Settings.ImportGCSTemplate.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => {
            if (value) {
                importTemplateFromGCS();
                game.settings.set("gum", "importGCSTemplateButton", false);
            }
        }
    });

    game.settings.register("gum", "importJSONButton", {
        name: "GUM.Settings.ImportItemsJson.Name",
        hint: "GUM.Settings.ImportItemsJson.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => {
            if (value) {
                importFromJson(); // Chama a função do importers.js
                game.settings.set("gum", "importJSONButton", false); // Reseta o botão
            }
        }
 });

    game.settings.register("gum", "exportJSONCompendiumButton", {
        name: "GUM.Settings.ExportCompendiumJson.Name",
        hint: "GUM.Settings.ExportCompendiumJson.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => {
            if (value) {
                exportCompendiumToJson();
                game.settings.set("gum", "exportJSONCompendiumButton", false);
            }
        }
    });

    game.settings.register("gum", "exportCharacterJSONButton", {
        name: "GUM.Settings.ExportCharacterJson.Name",
        hint: "GUM.Settings.ExportCharacterJson.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => {
            if (value) {
                exportCharacterToJson();
                game.settings.set("gum", "exportCharacterJSONButton", false);
            }
        }
    });
}
