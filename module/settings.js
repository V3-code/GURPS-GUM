// GUM/module/settings.js

const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

/**
 * A FUNÇÃO DE SINCRONIZAÇÃO (V2 - Corrigida)
 */
async function syncCompendiumRules() {
    ui.notifications.info(localize("GUM.Settings.Sync.Starting"));

    const pack = game.packs.get("gum.Regras");
    if (!pack) {
        return ui.notifications.error(localize("GUM.Settings.Sync.PackNotFound"));
    }

    const sourceRules = await pack.getDocuments();
    const sourceRulesMap = new Map();
    for (const rule of sourceRules) {
        sourceRulesMap.set(rule.uuid, rule);
    }

    if (sourceRulesMap.size === 0) {
        return ui.notifications.warn(localize("GUM.Settings.Sync.EmptyPack"));
    }

    let updateCount = 0;
    const actorsToUpdate = game.actors.filter(a => a.type === "character");

    for (const actor of actorsToUpdate) {
        const updates = [];
        const itemsToUpdate = actor.items.filter(i => i._stats.compendiumSource);

        for (const item of itemsToUpdate) {
            const sourceId = item._stats.compendiumSource; 
            const sourceRule = sourceRulesMap.get(sourceId);

            if (sourceRule) {
                const sourceData = sourceRule.toObject();
                updates.push({
                    _id: item.id,
                    system: sourceData.system,
                    img: sourceData.img
                });
            }
        }

        if (updates.length > 0) {
            await actor.updateEmbeddedDocuments("Item", updates);
            updateCount += updates.length;
        }
    }

    ui.notifications.info(format("GUM.Settings.Sync.Complete", { rules: updateCount, characters: actorsToUpdate.length }));
}

// --- IMPORTA A LÓGICA DOS IMPORTADORES ---
import { importFromJson, importFromGCS, importTemplateFromGCS, exportCompendiumToJson, exportCharacterToJson } from "./apps/importers.js";


// --- REGISTRO DAS CONFIGURAÇÕES ---

export const registerSystemSettings = function() {

 game.settings.register("gum", "effectTokenIconPolicyMigration", {
        name: localize("GUM.Settings.Internal.EffectTokenIconPolicyMigration"),
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register("gum", "effectActionsSchemaMigrationV2", {
        name: localize("GUM.Settings.Internal.EffectActionsSchemaMigration"),
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

// --- CONFIGURAÇÃO DE LAYOUT DO ESCUDO DO MESTRE ---
    game.settings.register("gum", "gmScreenConfig", {
        name: localize("GUM.Settings.Internal.GMScreenLayout"),
        scope: "world",
        config: false, // Invisível no menu, gerenciado via código
        type: Object,
        default: {
            groups: []
        }
    });
    
    // --- FÓRMULA DE INICIATIVA CORRIGIDA ---
    game.settings.register("gum", "initiativeFormula", {
        name: localize("GUM.Settings.InitiativeFormula.Name"),
        hint: localize("GUM.Settings.InitiativeFormula.Hint"),
        scope: "world",
        config: true,
        type: String,
        default: "@attributes.basic_speed.final + (@attributes.dx.final/100) + (1d6/1000)",

        
        onChange: value => {
             new Dialog({
                title: localize("GUM.Settings.InitiativeFormula.ReloadTitle"),
                content: `<p>${localize("GUM.Settings.InitiativeFormula.ReloadContent")}</p>`,
                buttons: {
                    reload: { icon: '<i class="fas fa-redo"></i>', label: localize("GUM.Settings.InitiativeFormula.ReloadNow"), callback: () => window.location.reload() },
                    later: { icon: '<i class="fas fa-times"></i>', label: localize("GUM.Settings.InitiativeFormula.RemindLater") }
                },
                default: "reload"
            }).render(true);
        }
    });

    // --- CONFIGURAÇÃO DE ADIÇÃO DE REGRAS PADRÃO ---
    game.settings.register("gum", "addDefaultRules", {
        name: localize("GUM.Settings.DefaultRules.Name"),
        hint: localize("GUM.Settings.DefaultRules.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

        // --- "BOTÃO" DE ATUALIZAÇÃO ---
    game.settings.register("gum", "syncCompendiumRulesBtn", {
        name: localize("GUM.Settings.SyncRules.Name"),
        hint: localize("GUM.Settings.SyncRules.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => {
            if (value) {
                console.log("GUM | Sincronização de regras iniciada pelo GM...");
                syncCompendiumRules(); 
                game.settings.set("gum", "syncCompendiumRulesBtn", false); 
            }
        }
    });

    game.settings.register("gum", "statusBindingsCompendium", {
        name: localize("GUM.Settings.StatusBindings.Name"),
        hint: localize("GUM.Settings.StatusBindings.Hint"),
        scope: "world",
        config: true,
        type: String,
        default: "gum.status_bindings"
    });



    game.settings.register("gum", "defaultSkillRollFormula", {
        name: localize("GUM.Settings.DefaultSkillRoll.Name"),
        hint: localize("GUM.Settings.DefaultSkillRoll.Hint"),
        scope: "world",
        config: true,
        type: String,
        default: "3d6"
    });

    game.settings.register("gum", "autoDistanceModifierEnabled", {
        name: localize("GUM.Settings.AutoDistance.Name"),
        hint: localize("GUM.Settings.AutoDistance.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("gum", "autoDistanceModifierTable", {
        name: localize("GUM.Settings.DistanceTable.Name"),
        hint: localize("GUM.Settings.DistanceTable.Hint"),
        scope: "world",
        config: true,
        type: String,
        choices: {
            standard: localize("GUM.Settings.DistanceTable.Standard"),
            monster_hunters: localize("GUM.Settings.DistanceTable.MonsterHunters"),
            hybrid: localize("GUM.Settings.DistanceTable.Hybrid")
        },
        default: "standard"
    });

    game.settings.register("gum", "normalizeGurpsDamageDice", {
        name: localize("GUM.Settings.NormalizeDamageDice.Name"),
        hint: localize("GUM.Settings.NormalizeDamageDice.Hint"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });



    // =============================================================
    // NOVOS BOTÕES DE IMPORTAÇÃO
    // =============================================================

    game.settings.register("gum", "importGCSButton", {
        name: localize("GUM.Settings.ImportGCS.Name"),
        hint: localize("GUM.Settings.ImportGCS.Hint"),
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
        name: localize("GUM.Settings.ImportGCSTemplate.Name"),
        hint: localize("GUM.Settings.ImportGCSTemplate.Hint"),
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
        name: localize("GUM.Settings.ImportItems.Name"),
        hint: localize("GUM.Settings.ImportItems.Hint"),
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
        name: localize("GUM.Settings.ExportCompendium.Name"),
        hint: localize("GUM.Settings.ExportCompendium.Hint"),
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
        name: localize("GUM.Settings.ExportCharacter.Name"),
        hint: localize("GUM.Settings.ExportCharacter.Hint"),
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