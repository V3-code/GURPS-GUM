import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestPath = new URL("../system.json", import.meta.url);
const screens = [
    {
        name: "damage roll prompt",
        template: new URL("../templates/apps/damage-roll-prompt.hbs", import.meta.url),
        script: new URL("../module/apps/damage-roll-prompt.js", import.meta.url)
    },
    {
        name: "modifier browser",
        template: new URL("../templates/apps/modifier-browser.hbs", import.meta.url),
        script: new URL("../module/apps/modifier-browser.js", import.meta.url)
    },
    {
        name: "condition browser",
        template: new URL("../templates/apps/condition-browser.hbs", import.meta.url),
        script: new URL("../module/apps/condition-browser.js", import.meta.url)
    },
    {
        name: "effect browser",
        template: new URL("../templates/apps/effect-browser.hbs", import.meta.url),
        script: new URL("../module/apps/effect-browser.js", import.meta.url)
    },
    {
        name: "trigger browser",
        template: new URL("../templates/apps/trigger-browser.hbs", import.meta.url),
        script: new URL("../module/apps/trigger-browser.js", import.meta.url)
    },
    {
        name: "GM modifier browser",
        template: new URL("../templates/apps/gm-modifier-browser.hbs", import.meta.url),
        script: new URL("../module/apps/gm-modifier-browser.js", import.meta.url)
    },
    {
        name: "template browser",
        template: new URL("../templates/apps/template-browser.hbs", import.meta.url),
        script: new URL("../module/apps/template-browser.js", import.meta.url)
    },
    {
        name: "equipment modifier browser",
        template: new URL("../templates/apps/eqp-modifier-browser.hbs", import.meta.url),
        script: new URL("../module/apps/eqp-modifier-browser.js", import.meta.url)
    },
    {
        name: "secondary stats recalculation",
        template: new URL("../templates/apps/secondary-stats-recalculation.hbs", import.meta.url),
        script: new URL("../module/actor/gurps-actor-sheet.js", import.meta.url),
        scriptStart: "async _onRecalculateSecondaryStats",
        scriptEnd: "\n_getBasicDamageFromST(stValue) {"
    }
];
const languagePaths = {
    "pt-BR": new URL("../lang/pt-BR.json", import.meta.url),
    en: new URL("../lang/en.json", import.meta.url)
};

function flattenKeys(value, prefix = "") {
    return Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return child && typeof child === "object" ? flattenKeys(child, path) : [path];
    });
}

function directLocalizationKeys(source) {
    return new Set(Array.from(source.matchAll(
        /(?:localize|format)(?:\(\s*|\s+)["']([^"']+)["']/g
    ), (match) => match[1]));
}

async function readScreenSources() {
    return Promise.all(screens.map(async (screen) => {
        const completeScriptSource = await readFile(screen.script, "utf8");
        const selectedScriptSource = screen.scriptStart
            ? completeScriptSource.split(screen.scriptStart, 2)[1]
            : completeScriptSource;
        const scriptSource = screen.scriptEnd
            ? selectedScriptSource.slice(0, selectedScriptSource.indexOf(screen.scriptEnd))
            : selectedScriptSource;
        return {
            ...screen,
            templateSource: await readFile(screen.template, "utf8"),
            scriptSource
        };
    }));
}

function assertBalancedHandlebars(template) {
    assert.equal((template.match(/{{/g) || []).length, (template.match(/}}/g) || []).length);

    const blocks = [];
    for (const match of template.matchAll(/{{([#/])\s*([\w-]+)/g)) {
        if (match[1] === "#") blocks.push(match[2]);
        else assert.equal(blocks.pop(), match[2], `unbalanced Handlebars block: ${match[2]}`);
    }
    assert.deepEqual(blocks, []);
}

test("manifest registers the two native Foundry languages", async () => {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    assert.deepEqual(manifest.languages, [
        { lang: "pt-BR", name: "Português (Brasil)", path: "lang/pt-BR.json" },
        { lang: "en", name: "English", path: "lang/en.json" }
    ]);
});

test("language files have identical, populated keys", async () => {
    const languages = Object.fromEntries(await Promise.all(Object.entries(languagePaths).map(
        async ([language, path]) => [language, JSON.parse(await readFile(path, "utf8"))]
    )));
    const portugueseKeys = flattenKeys(languages["pt-BR"]).sort();
    const englishKeys = flattenKeys(languages.en).sort();

    assert.deepEqual(englishKeys, portugueseKeys);
    for (const language of Object.values(languages)) {
        for (const key of portugueseKeys) {
            const value = key.split(".").reduce((current, part) => current[part], language);
            assert.equal(typeof value, "string", `${key} must contain text`);
            assert.notEqual(value.trim(), "", `${key} must not be empty`);
        }
    }
});

test("localized screens reference every localization key and only defined keys", async () => {
    const [screenSources, portuguese] = await Promise.all([
        readScreenSources(),
        readFile(languagePaths["pt-BR"], "utf8").then(JSON.parse)
    ]);
    const defined = new Set(flattenKeys(portuguese));
    const used = new Set(screenSources.flatMap(({ templateSource, scriptSource }) => [
        ...directLocalizationKeys(templateSource),
        ...directLocalizationKeys(scriptSource)
    ]));

    for (const section of ["main", "followUp", "fragmentation"]) {
        used.add(`GUM.DamageRollPrompt.Sections.${section}`);
    }
    for (const key of ["AddedOne", "AddedMany"]) {
        used.add(`GUM.ModifierBrowser.${key}`);
    }
    for (const key of ["AttachedOne", "AttachedMany"]) {
        used.add(`GUM.ConditionBrowser.${key}`);
    }
    for (const key of ["Attribute", "Flag", "RollModifier", "Status", "Chat", "Macro", "AddedOne", "AddedMany"]) {
        used.add(`GUM.EffectBrowser.${key}`);
    }
    for (const key of ["Configured", "Empty"]) {
        used.add(`GUM.TriggerBrowser.${key}`);
    }
    for (const category of [
        "location", "maneuver", "attack_opt", "defense_opt", "posture", "range", "terrain_light", "state_affliction",
        "task_difficulty", "ritual", "power_operation", "time", "effort", "situation", "equipment", "other"
    ]) {
        used.add(`GUM.GMModifierBrowser.Categories.${category}`);
    }
    for (const key of ["AddedOne", "AddedMany"]) {
        used.add(`GUM.EquipmentModifierBrowser.${key}`);
    }
    for (const key of [
        "RecalculateTooltip", "Title", "Introduction", "PreparedValuesHint", "QuickActions", "Recommended", "All", "Clear",
        "ShowUnchanged", "Attribute", "Current", "Calculated", "ToggleGroup", "Override", "Changed", "Unchanged", "ApplyChanges",
        "ApplyOne", "ApplyMany", "AppliedOne", "AppliedMany", "CalculationFailure", "ApplyFailure", "ChangedOne", "ChangedMany",
        "ModifierDetail", "FinalComparisonDetail", "DependencyWarning", "PerceptionAbbreviation", "PrimaryFinal", "PrimaryAdjusted",
        "ProtectedByOverride"
    ]) {
        used.add(`GUM.SecondaryStatsRecalculation.${key}`);
    }
    for (const group of ["Resources", "Physical", "Movement", "Senses", "Damage"]) {
        used.add(`GUM.SecondaryStatsRecalculation.Groups.${group}`);
    }
    for (const entry of ["HPMax", "FPMax", "LiftingST", "BasicSpeed", "BasicMove", "Dodge", "Vision", "Hearing", "TasteSmell", "Touch", "ThrustDamage", "SwingDamage"]) {
        used.add(`GUM.SecondaryStatsRecalculation.Entries.${entry}`);
    }
    for (const reason of ["CalculatedFrom", "BasicSpeed", "BasicMove", "Dodge", "DamageTable"]) {
        used.add(`GUM.SecondaryStatsRecalculation.Reasons.${reason}`);
    }
    for (const warning of ["MaximumBelowCurrent", "RemoveImportedDodge"]) {
        used.add(`GUM.SecondaryStatsRecalculation.Warnings.${warning}`);
    }

    assert.deepEqual([...used].sort(), [...defined].sort());
});

test("damage roll pilot localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const pilotKeys = [
        "GUM.Common.Cancel",
        "GUM.DamageRollPrompt.Title",
        "GUM.DamageRollPrompt.Heading",
        "GUM.DamageRollPrompt.SituationalModifiers",
        "GUM.DamageRollPrompt.StandardDamage",
        "GUM.DamageRollPrompt.FragmentationDamage",
        "GUM.DamageRollPrompt.FollowUpDamage",
        "GUM.DamageRollPrompt.StandardPlaceholder",
        "GUM.DamageRollPrompt.FragmentationPlaceholder",
        "GUM.DamageRollPrompt.FollowUpPlaceholder",
        "GUM.DamageRollPrompt.TypePlaceholder",
        "GUM.DamageRollPrompt.Roll",
        "GUM.DamageRollPrompt.RollTooltip",
        "GUM.DamageRollPrompt.ReviewAdditionalDamage",
        "GUM.DamageRollPrompt.InvalidExpression",
        "GUM.DamageRollPrompt.SelectDamageType",
        "GUM.DamageRollPrompt.Sections.main",
        "GUM.DamageRollPrompt.Sections.followUp",
        "GUM.DamageRollPrompt.Sections.fragmentation"
    ];
    for (const key of pilotKeys) assert.ok(defined.has(key), `missing pilot key: ${key}`);
});

test("modifier browser localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const modifierKeys = [
        "Title", "Search", "SearchPlaceholder", "Enhancements", "Limitations", "ViewTooltip",
        "NoResults", "AddSelected", "FolderFallback", "ModifierFallback", "ModifierType",
        "NoDescription", "Ref", "Effect", "NoSelection", "AddedOne", "AddedMany"
    ];
    for (const key of modifierKeys) {
        assert.ok(defined.has(`GUM.ModifierBrowser.${key}`), `missing modifier browser key: ${key}`);
    }
});

test("effect and trigger browser localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const browserKeys = {
        EffectBrowser: [
            "Title", "Search", "SearchPlaceholder", "Type", "Attribute", "Status", "RollModifier", "Chat", "Macro", "Flag",
            "ViewTooltip", "NoResults", "AddSelected", "EffectFallback", "NoDescription", "Modifier", "Ref", "NoSelection",
            "AddedOne", "AddedMany"
        ],
        TriggerBrowser: [
            "Title", "Search", "SearchPlaceholder", "ViewTooltip", "NoResults", "InsertTrigger", "FolderFallback",
            "NoSelection", "NoDescription", "TriggerFallback", "Code", "Configured", "Empty"
        ]
    };

    for (const [browser, keys] of Object.entries(browserKeys)) {
        for (const key of keys) {
            assert.ok(defined.has(`GUM.${browser}.${key}`), `missing ${browser} key: ${key}`);
        }
    }
});

test("GM modifier and template browser localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const browserKeys = {
        GMModifierBrowser: [
            "Title", "Search", "SearchPlaceholder", "Type", "Bonus", "Penalty", "CategoriesLabel", "ViewTooltip",
            "NoResults", "AddSelected", "FolderFallback", "ModifierSubtitle", "CategorySubtitle", "GroupSubtitle",
            "CapSubtitle", "ModifierType", "NoDescription", "Value", "Cap", "Duration", "NoSelection"
        ],
        TemplateBrowser: [
            "Title", "Search", "SearchPlaceholder", "FoldersAndSubfolders", "ViewTooltip", "NoResults", "ApplyTemplate",
            "CompendiumMissing", "ReadFailure", "TemplateFallback", "TemplateType", "DefaultDescription", "Category", "Blocks",
            "Source", "Folder", "NoFolder", "NoSelection", "SelectedNotFound"
        ]
    };

    for (const [browser, keys] of Object.entries(browserKeys)) {
        for (const key of keys) {
            assert.ok(defined.has(`GUM.${browser}.${key}`), `missing ${browser} key: ${key}`);
        }
    }
    for (const category of [
        "location", "maneuver", "attack_opt", "defense_opt", "posture", "range", "terrain_light", "state_affliction",
        "task_difficulty", "ritual", "power_operation", "time", "effort", "situation", "equipment", "other"
    ]) {
        assert.ok(defined.has(`GUM.GMModifierBrowser.Categories.${category}`), `missing GM modifier category: ${category}`);
    }
});

test("equipment modifier browser localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const keys = [
        "Title", "Search", "SearchPlaceholder", "Category", "CostFactor", "Min", "Max", "ViewTooltip", "NoResults",
        "AddSelected", "ModifierFallback", "ModifierType", "NoDescription", "Weight", "TechLevel", "CategoriesLabel",
        "NoSelection", "AddedOne", "AddedMany"
    ];
    for (const key of keys) {
        assert.ok(defined.has(`GUM.EquipmentModifierBrowser.${key}`), `missing equipment modifier browser key: ${key}`);
    }
    for (const category of ["all", "general", "enchantment", "melee", "ranged", "armor", "shield", "ammo"]) {
        assert.ok(defined.has(`GUM.EquipmentModifierBrowser.Categories.${category}`), `missing equipment category: ${category}`);
    }
});

test("secondary stats recalculation localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const keys = [
        "RecalculateTooltip", "Title", "Introduction", "PreparedValuesHint", "QuickActions", "Recommended", "All", "Clear",
        "ShowUnchanged", "Attribute", "Current", "Calculated", "ToggleGroup", "Override", "Changed", "Unchanged", "ApplyChanges",
        "ApplyOne", "ApplyMany", "AppliedOne", "AppliedMany", "CalculationFailure", "ApplyFailure", "ChangedOne", "ChangedMany",
        "ModifierDetail", "FinalComparisonDetail", "DependencyWarning", "PerceptionAbbreviation", "PrimaryFinal", "PrimaryAdjusted",
        "ProtectedByOverride"
    ];
    for (const key of keys) {
        assert.ok(defined.has(`GUM.SecondaryStatsRecalculation.${key}`), `missing secondary stats key: ${key}`);
    }
    for (const group of ["Resources", "Physical", "Movement", "Senses", "Damage"]) {
        assert.ok(defined.has(`GUM.SecondaryStatsRecalculation.Groups.${group}`), `missing secondary stats group: ${group}`);
    }
    for (const entry of ["HPMax", "FPMax", "LiftingST", "BasicSpeed", "BasicMove", "Dodge", "Vision", "Hearing", "TasteSmell", "Touch", "ThrustDamage", "SwingDamage"]) {
        assert.ok(defined.has(`GUM.SecondaryStatsRecalculation.Entries.${entry}`), `missing secondary stats entry: ${entry}`);
    }
    for (const reason of ["CalculatedFrom", "BasicSpeed", "BasicMove", "Dodge", "DamageTable"]) {
        assert.ok(defined.has(`GUM.SecondaryStatsRecalculation.Reasons.${reason}`), `missing secondary stats reason: ${reason}`);
    }
    for (const warning of ["MaximumBelowCurrent", "RemoveImportedDodge"]) {
        assert.ok(defined.has(`GUM.SecondaryStatsRecalculation.Warnings.${warning}`), `missing secondary stats warning: ${warning}`);
    }
});

test("localized screen Handlebars expressions and blocks are balanced", async () => {
    for (const { name, templateSource } of await readScreenSources()) {
        assert.doesNotThrow(() => assertBalancedHandlebars(templateSource), name);
    }
});

test("modifier browser reachable flow has no fixed Portuguese UI text", async () => {
    const modifierScreen = (await readScreenSources()).find(({ name }) => name === "modifier browser");
    const reachableScript = modifierScreen.scriptSource.split("      const createTag =", 1)[0]
        + modifierScreen.scriptSource.split("  async _updateObject", 2)[1];
    const fixedPortuguese = [
        "Buscar", "Pastas", "Custo", "Ampliações", "Limitações", "Visualizar modificador",
        "Nenhum modificador encontrado", "Adicionar Selecionados", "Navegador de Modificadores",
        "Pasta", "Modificador", "Sem descrição", "Efeito", "Nenhum modificador foi selecionado",
        "adicionado", "adicionados"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!modifierScreen.templateSource.includes(text), `fixed template text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable script text: ${text}`);
    }
});

test("condition browser reachable flow has no fixed Portuguese UI text", async () => {
    const conditionScreen = (await readScreenSources()).find(({ name }) => name === "condition browser");
    const beforePreviewReturn = conditionScreen.scriptSource.split("      return GumPreviewDialog.show(", 1)[0];
    const previewCall = conditionScreen.scriptSource.split("      return GumPreviewDialog.show(", 2)[1]
        .split("      const createTag =", 1)[0];
    const updateFlow = conditionScreen.scriptSource.split("  async _updateObject", 2)[1];
    const reachableScript = `${beforePreviewReturn}${previewCall}${updateFlow}`
        .replace(/\/\/.*$/gm, "");
    const fixedPortuguese = [
        "Buscar", "Pastas", "Tipo de Efeito", "Atributo", "Visualizar condição",
        "Nenhuma condição encontrada", "Anexar Selecionadas", "Navegador de Condições",
        "Sem descrição", "Efeitos", "Nenhuma condição foi selecionada", "anexada", "anexadas"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!conditionScreen.templateSource.includes(text), `fixed template text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable script text: ${text}`);
    }
});

test("condition browser keeps mechanical selectors and values while formatting attachment counts", async () => {
    const conditionScreen = (await readScreenSources()).find(({ name }) => name === "condition browser");
    for (const name of ["search", "filter-folder", "filter-attribute", "filter-status", "filter-chat", "filter-macro", "filter-flag"]) {
        assert.match(conditionScreen.templateSource, new RegExp(`name="${name}"`));
    }
    for (const type of ["attribute", "status", "chat", "macro", "flag"]) {
        assert.match(conditionScreen.scriptSource, new RegExp(`\\b${type}: form\\.querySelector\\('\\[name="filter-${type}"\\]'\\)\\.checked`));
    }
    assert.ok(conditionScreen.templateSource.includes('value="{{folder.id}}"'));
    assert.ok(conditionScreen.templateSource.includes('name="{{condition.id}}"'));
    assert.match(conditionScreen.scriptSource, /selectedConditions\.length === 1/);
    assert.match(conditionScreen.scriptSource, /game\.i18n\.format\(notificationKey, \{ count: selectedConditions\.length \}\)/);
});

test("effect browser reachable flow has no fixed Portuguese UI text", async () => {
    const effectScreen = (await readScreenSources()).find(({ name }) => name === "effect browser");
    const templateSource = effectScreen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const reachableScript = effectScreen.scriptSource.replace(/\/\/.*$/gm, "");
    const fixedPortuguese = [
        "Buscar efeito...", "Mod. Rolagem", "Visualizar efeito", "Nenhum efeito encontrado",
        "Adicionar Selecionados", "Navegador de Efeitos", "Modificador de Rolagem",
        "Sem descrição.", "Nenhum efeito foi selecionado.", "efeito(s) adicionado(s)"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed effect template text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable effect script text: ${text}`);
    }
});

test("trigger browser reachable flow has no fixed Portuguese UI text", async () => {
    const triggerScreen = (await readScreenSources()).find(({ name }) => name === "trigger browser");
    const templateSource = triggerScreen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const reachableScript = triggerScreen.scriptSource.split("      const content =", 1)[0]
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const fixedPortuguese = [
        "Buscar gatilho...", "Visualizar gatilho", "Nenhum gatilho encontrado", "Inserir Gatilho",
        "Navegador de Gatilhos", "Nenhum gatilho foi selecionado.", "Sem descrição.", "Configurado", "Vazio"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed trigger template text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable trigger script text: ${text}`);
    }
});

test("effect and trigger browsers preserve mechanical behavior while localizing dynamic labels", async () => {
    const screenSources = await readScreenSources();
    const effectScreen = screenSources.find(({ name }) => name === "effect browser");
    const triggerScreen = screenSources.find(({ name }) => name === "trigger browser");

    for (const name of ["search", "filter-folder", "filter-attribute", "filter-status", "filter-roll_modifier", "filter-chat", "filter-macro", "filter-flag"]) {
        assert.match(effectScreen.templateSource, new RegExp(`name="${name}"`));
    }
    for (const type of ["attribute", "flag", "roll_modifier", "status", "chat", "macro"]) {
        assert.match(effectScreen.scriptSource, new RegExp(`\\b${type}: "GUM\\.EffectBrowser\\.`));
    }
    assert.match(effectScreen.scriptSource, /localizationKey \? game\.i18n\.localize\(localizationKey\) : type \|\| "-"/);
    const effectTypeMapping = effectScreen.scriptSource.split("const EFFECT_TYPE_LABEL_KEYS = {", 2)[1].split("};", 1)[0];
    assert.doesNotMatch(effectTypeMapping, /game\.i18n/);
    assert.match(effectScreen.scriptSource, /selectedEffects\.length === 1/);
    assert.match(effectScreen.scriptSource, /game\.i18n\.format\(notificationKey, \{ count: selectedEffects\.length \}\)/);

    assert.match(triggerScreen.templateSource, /type="radio" name="triggerSelection" value="{{trigger\.id}}"/);
    assert.match(triggerScreen.templateSource, /{{#if \(eq index 0\)}}checked{{\/if}}/);
    assert.match(triggerScreen.scriptSource, /textarea\.value = textarea\.value\.substring\(0, start\) \+ code \+ textarea\.value\.substring\(end\)/);
    assert.match(triggerScreen.scriptSource, /textarea\.setSelectionRange\(newCursorPos, newCursorPos\)/);
    assert.match(triggerScreen.scriptSource, /foundry\.utils\.escapeHTML\(system\.code\)/);
    assert.match(triggerScreen.scriptSource, /system\.code \? "GUM\.TriggerBrowser\.Configured" : "GUM\.TriggerBrowser\.Empty"/);
});

test("GM modifier browser reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "GM modifier browser");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const reachableScript = screen.scriptSource
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const fixedPortuguese = [
        "Navegador de Modificadores Globais", "Modificador:", "Categoria:", "Grupo:", "Teto ", "Pasta",
        "Modificador GM", "Sem descrição.", "Duração", "Nenhum modificador foi selecionado.",
        "Bônus (+)", "Penalidade (-)", "Ver detalhes", "Nenhum modificador encontrado", "Adicionar Selecionados"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed GM modifier template text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable GM modifier script text: ${text}`);
    }
});

test("template browser reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "template browser");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const reachableScript = screen.scriptSource.split("    const content =", 1)[0]
        + screen.scriptSource.split("  async _updateObject", 2)[1];
    const fixedPortuguese = [
        "Navegador de Modelos", "Compêndio de Modelos não encontrado", "Falha ao ler compêndio",
        "Modelo de personagem.", "Pastas e Subpastas", "Visualizar modelo", "Nenhum Modelo encontrado",
        "Aplicar Modelo", "Nenhum Modelo foi selecionado.", "Modelo selecionado não encontrado."
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed template browser text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable template browser script text: ${text}`);
    }
});

test("GM modifier and template browsers preserve selectors, category IDs and selection behavior", async () => {
    const screenSources = await readScreenSources();
    const gmScreen = screenSources.find(({ name }) => name === "GM modifier browser");
    const templateScreen = screenSources.find(({ name }) => name === "template browser");

    for (const name of ["search", "filter-folder", "filter-bonus", "filter-penalty"]) {
        assert.match(gmScreen.templateSource, new RegExp(`name="${name}"`));
    }
    assert.ok(gmScreen.templateSource.includes('value="{{category.id}}"'));
    assert.ok(gmScreen.templateSource.includes('name="{{this.id}}"'));
    assert.match(gmScreen.scriptSource, /normalizeGMModifierCategory\(item\.system\.ui_category \|\| "situation"\)/);
    assert.match(gmScreen.scriptSource, /getLocalizedCategoryLabel\(category\.id\)/);
    assert.match(gmScreen.scriptSource, /game\.i18n\.format\("GUM\.GMModifierBrowser\.ModifierSubtitle", \{ value: formattedVal \}\)/);

    assert.match(templateScreen.templateSource, /name="search"/);
    assert.match(templateScreen.templateSource, /name="filter-folder" value="{{folder\.id}}"/);
    assert.match(templateScreen.templateSource, /type="radio" name="selectedTemplate"[^>]*value="{{template\.id}}"/);
    assert.match(templateScreen.scriptSource, /formData\.selectedTemplate/);
    assert.match(templateScreen.scriptSource, /this\.onSelect\(selectedTemplate\)/);
});

test("equipment modifier browser reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "equipment modifier browser");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const beforeLegacyPreview = screen.scriptSource.split("      const createTag =", 1)[0];
    const afterLegacyPreview = screen.scriptSource.split("  _formatValue", 2)[1];
    const reachableScript = `${beforeLegacyPreview}${afterLegacyPreview}`
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const fixedPortuguese = [
        "Modificadores de Equipamento", "Nome ou Tags...", "Geral / Materiais", "Encantamentos", "Armas C.C.",
        "Armas Dist.", "Armaduras", "Escudos", "Munição", "Fator de Custo", "Ver detalhes",
        "Nenhum modificador de equipamento encontrado.", "Adicionar Selecionados", "Mod. Equipamento",
        "Sem descrição.", "Peso", "Categorias", "Nenhum modificador selecionado.", "modificadores adicionados."
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed equipment modifier template text: ${text}`);
        assert.ok(!reachableScript.includes(text), `fixed reachable equipment modifier script text: ${text}`);
    }
});

test("equipment modifier browser preserves filters, category IDs and modifier data", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "equipment modifier browser");
    for (const name of ["search", "filter-folder", "cfMin", "cfMax", "submit"]) {
        assert.match(screen.templateSource, new RegExp(`name="${name}"`));
    }
    for (const category of ["all", "general", "enchantment", "melee", "ranged", "armor", "shield", "ammo"]) {
        assert.match(screen.templateSource, new RegExp(`class="category-filter" value="${category}"`));
        assert.match(screen.scriptSource, new RegExp(`${category}: "GUM\\.EquipmentModifierBrowser\\.Categories\\.${category}"`));
    }
    for (const field of ["cost_adjustment", "cost_factor", "weight_mod", "tech_level_mod", "features", "ref", "source_uuid"]) {
        assert.match(screen.scriptSource, new RegExp(`\\b${field}:`));
    }
    assert.match(screen.scriptSource, /Object\.keys\(system\.target_type \|\| \{\}\)\.filter\(k => system\.target_type\[k\]\)\.map\(getLocalizedCategoryLabel\)/);
    assert.match(screen.scriptSource, /addedCount === 1/);
    assert.match(screen.scriptSource, /game\.i18n\.format\(notificationKey, \{ count: addedCount \}\)/);
});

test("secondary stats recalculation reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "secondary stats recalculation");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const fixedPortuguese = [
        "Analise os ajustes", "Ações rápidas", "Recomendados", "Todos", "Limpar", "Sem alteração", "Atributo", "Atual",
        "Calculado", "Selecionar ou desmarcar o grupo", "Alteração", "modificadores", "final estimado", "Seleção parcial",
        "Revisar atributos derivados", "Aplicar alterações", "Não foi possível calcular", "Não foi possível aplicar"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed secondary stats template text: ${text}`);
        assert.ok(!screen.scriptSource.includes(`"${text}`), `fixed reachable secondary stats script text: ${text}`);
    }

    const characterTemplate = await readFile(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
    assert.ok(!characterTemplate.includes('title="Recalcular bases de atributos secundários"'));
    assert.match(characterTemplate, /recalc-secondary-stats-btn" title="{{localize 'GUM\.SecondaryStatsRecalculation\.RecalculateTooltip'}}"/);
});

test("secondary stats recalculation preserves selectors, paths and update behavior while localizing presentation", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "secondary stats recalculation");
    const utilitySource = await readFile(new URL("../module/utils/secondary-stats-recalculation.mjs", import.meta.url), "utf8");

    for (const action of ["recommended", "all", "none", "unchanged"]) {
        assert.match(screen.templateSource, new RegExp(`data-action="${action}"`));
    }
    assert.match(screen.templateSource, /name="secondary-stat" value="{{id}}" data-group="{{group}}"/);
    assert.match(screen.templateSource, /class="secondary-group-toggle" data-group="{{id}}"/);
    assert.match(screen.scriptSource, /buildSecondaryStatsUpdateData\(plan, selectedIds\)/);
    assert.match(screen.scriptSource, /selectedIds\.length === 1/);
    assert.match(screen.scriptSource, /count === 1 \? "ApplyOne" : "ApplyMany"/);
    assert.match(screen.scriptSource, /localize: key => game\.i18n\.localize\(key\)/);
    assert.match(screen.scriptSource, /format: \(key, data\) => game\.i18n\.format\(key, data\)/);
    for (const path of [
        "system.attributes.hp.max", "system.attributes.fp.max", "system.attributes.lifting_st.value",
        "system.attributes.basic_speed.value", "system.attributes.basic_move.value", "system.attributes.dodge.value",
        "system.attributes.vision.value", "system.attributes.hearing.value", "system.attributes.tastesmell.value",
        "system.attributes.touch.value", "system.attributes.thrust_damage", "system.attributes.swing_damage"
    ]) {
        assert.ok(utilitySource.includes(`"${path}"`), `missing preserved update path: ${path}`);
    }
    assert.match(utilitySource, /buildSecondaryStatsRecalculationPlan\(system, getBasicDamageFromST, i18n = null\)/);
    assert.match(utilitySource, /if \(!selected\.has\(entry\.id\) \|\| !entry\.changed \|\| entry\.protectedByOverride\) continue/);
});
