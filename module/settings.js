// GUM/module/settings.js

/**
 * A FUNÇÃO DE SINCRONIZAÇÃO (V2 - Corrigida)
 */
async function syncCompendiumRules() {
    ui.notifications.info("Iniciando sincronização das Regras do Compêndio...");

    const { documents: sourceRules, invalidSources } = await contentSourceService.getDocuments("passiveConditions");
    const sourceRulesMap = new Map();
    for (const rule of sourceRules) {
        sourceRulesMap.set(rule.uuid, rule);
    }

    if (sourceRulesMap.size === 0) {
        const missing = invalidSources.map(source => source.id).join(", ");
        return ui.notifications.warn(missing
            ? `Nenhuma condição passiva disponível. Fontes inválidas: ${missing}.`
            : "As fontes configuradas de Condições Passivas estão vazias. Nenhuma regra para sincronizar.");
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

    ui.notifications.info(`Sincronização completa! ${updateCount} regras atualizadas em ${actorsToUpdate.length} personagens.`);
}

// --- IMPORTA A LÓGICA DOS IMPORTADORES ---
import { importFromJson, importFromGCS, importTemplateFromGCS, exportCompendiumToJson, exportCharacterToJson } from "./apps/importers.js";
import { ContentSourceConfig } from "./apps/content-source-config.js";
import { CONTENT_SOURCE_SETTING, contentSourceService } from "./services/content-source-service.mjs";

const STATUS_BINDINGS_MIGRATION_SETTING = "contentSourcesStatusBindingsMigrationV1";

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
        name: "Fontes de Conteúdo do GUM",
        hint: "Configuração interna das bibliotecas utilizadas pelas funções do sistema.",
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register("gum", STATUS_BINDINGS_MIGRATION_SETTING, {
        name: "Migração interna: fontes dos Vínculos de Status",
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.registerMenu("gum", "contentSourceConfig", {
        name: "Fontes de Conteúdo do GUM",
        label: "Configurar fontes",
        hint: "Escolha os compêndios usados pelos navegadores e automações do GUM.",
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
        name: "Fórmula de Iniciativa (GUM)",
        hint: "Fórmula padrão do GURPS: Velocidade Básica, com DX como desempate e 1d6 como segundo desempate.",
        scope: "world",
        config: true,
        type: String,
        default: "@attributes.basic_speed.final + (@attributes.dx.final/100) + (1d6/1000)",

        
        onChange: value => {
             new Dialog({
                title: "Recarregar Necessário",
                content: "<p>A fórmula de iniciativa foi alterada. Para que a mudança tenha efeito, o Foundry precisa ser recarregado.</p>",
                buttons: {
                    reload: { icon: '<i class="fas fa-redo"></i>', label: "Recarregar Agora", callback: () => window.location.reload() },
                    later: { icon: '<i class="fas fa-times"></i>', label: "Lembrar-me Depois" }
                },
                default: "reload"
            }).render(true);
        }
    });

    // --- CONFIGURAÇÃO DE ADIÇÃO DE REGRAS PADRÃO ---
    game.settings.register("gum", "addDefaultRules", {
        name: "Condições Passivas em Personagens",
        hint: "Se marcado, adiciona automaticamente aos novos personagens todas as condições das fontes configuradas em 'Condições Passivas'.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

        // --- "BOTÃO" DE ATUALIZAÇÃO ---
    game.settings.register("gum", "syncCompendiumRulesBtn", {
        name: "Sincronizar Condições Passivas",
        hint: "MARQUE e SALVE para atualizar as Condições Passivas dos personagens a partir das fontes configuradas. A caixa desmarcará automaticamente após o uso.",
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
        name: "Compêndio de Vínculos de Status",
        hint: "ID do compêndio que contém Itens Condição no modo 'Vínculo de Status' (ex.: gum.status_bindings). Se vazio, usa gum.conditions.",
        scope: "world",
        config: false,
        type: String,
        default: "gum.status_bindings"
    });

    game.settings.register("gum", "hybridImportSearchAllCompendia", {
        name: "Importação híbrida: pesquisar outros compêndios",
        hint: "Se ativado, a importação de personagens também procura correspondências em todos os compêndios de Itens, depois dos itens do mundo e das fontes configuradas. Pode selecionar conteúdo inesperado de módulos.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });



    game.settings.register("gum", "defaultSkillRollFormula", {
        name: "Dados de Rolgem padrão",
        hint: "Defina os dados que serão usados em rolagens de testes habilidades (ex.: 3d6, 2d10, 1d20).",
        scope: "world",
        config: true,
        type: String,
        default: "3d6"
    });

    game.settings.register("gum", "autoDistanceModifierEnabled", {
        name: "Modificador de Distância",
        hint: "Calcula automaticamente o modificador de distância no Prompt de Rolagem quando houver um atacante ativo e um alvo único selecionado.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register("gum", "autoDistanceModifierTable", {
        name: "Tabela de distância",
        hint: "Define qual tabela usar para o cálculo automático de distância se a opção de 'Modificador de Distância' estiver ativada.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            standard: "Padrão (GURPS)",
            monster_hunters: "Resumida (Monster Hunters)",
            hybrid: "Híbrida (MH + Padrão)"
        },
        default: "standard"
    });

        game.settings.register("gum", "autoSizeModifierMode", {
        name: "Modificador de Tamanho automático",
        hint: "Em rolagens de ataque com um único alvo, aplica o MT final do alvo pela regra básica ou calcula o MT relativo (MT do alvo menos MT da origem).",
        scope: "world",
        config: true,
        type: String,
        choices: {
            off: "Desativado",
            target: "MT do alvo (regra básica)",
            relative: "MT relativo (alvo menos origem)"
        },
        default: "off"
    });

    game.settings.register("gum", "normalizeGurpsDamageDice", {
        name: "Normalizar dados de dano",
        hint: "(GURPS: Modifying Dice + Adds) Converte automaticamente fórmulas Xd6+Y/Xd6-Y com modificadores altos para mais/menos dados, sem reduzir abaixo de 1d6.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });



    // =============================================================
    // NOVOS BOTÕES DE IMPORTAÇÃO
    // =============================================================

    game.settings.register("gum", "importGCSButton", {
        name: "Importar Personagem do GCS",
        hint: "Importa uma ficha de personagem completa a partir de um arquivo .gcs (JSON). Isso criará um novo Ator.",
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
        name: "Importar Template do GCS",
        hint: "Importa um arquivo .gct/.gcs de template do GCS e cria um Item do tipo Modelo com blocos para aplicação na ficha.",
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
        name: "Importar Itens (JSON)",
        hint: "Ferramenta do Mestre. Importa um arquivo .json de itens (Perícias, Vantagens, etc.) diretamente para o compêndio do sistema correspondente.",
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
        name: "Exportar Compêndio (JSON)",
        hint: "Ferramenta do Mestre. Exporta o conteúdo de um compêndio de Itens para um arquivo .json.",
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
        name: "Exportar Ficha de Personagem (JSON)",
        hint: "Exporta uma ficha de personagem para um arquivo .json para backup e reutilização.",
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
