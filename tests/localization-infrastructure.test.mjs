import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GUM_DATA } from "../scripts/gum-data.js";
import { ROLL_PURPOSES, ROLL_PURPOSE_GROUPS } from "../module/utils/roll-purposes.mjs";
import { ROLL_TAG_CATALOG, ROLL_TAG_GROUPS } from "../module/utils/roll-tags.mjs";

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
    },
    {
        name: "preview dialog",
        template: null,
        script: new URL("../module/apps/preview-dialog.js", import.meta.url)
    },
    {
        name: "trigger sheet",
        template: new URL("../templates/items/trigger-sheet.hbs", import.meta.url),
        script: new URL("../scripts/apps/trigger-sheet.js", import.meta.url)
    },
    {
        name: "condition builder",
        template: new URL("../templates/apps/condition-builder.hbs", import.meta.url),
        script: new URL("../scripts/apps/condition-builder.js", import.meta.url)
    },
    {
        name: "condition sheet",
        template: new URL("../templates/items/condition-sheet.hbs", import.meta.url),
        script: new URL("../scripts/apps/condition-sheet.js", import.meta.url)
    },
    {
        name: "effect sheet description",
        template: new URL("../templates/items/effect-sheet.hbs", import.meta.url),
        script: new URL("../scripts/apps/effect-sheet.js", import.meta.url)
    },
    {
        name: "template item sheet",
        template: new URL("../templates/items/template-item-sheet.hbs", import.meta.url),
        script: new URL("../module/item/template-item-sheet.js", import.meta.url)
    },
    {
        name: "damage application",
        template: new URL("../templates/apps/damage-application.hbs", import.meta.url),
        script: new URL("../scripts/apps/damage-application.js", import.meta.url)
    },
    {
        name: "roll purpose catalog",
        template: null,
        script: new URL("../module/utils/roll-purposes.mjs", import.meta.url)
    },
    {
        name: "roll purpose picker",
        template: null,
        script: new URL("../module/apps/roll-purpose-picker.mjs", import.meta.url)
    },
    {
        name: "purpose quick view",
        template: null,
        script: new URL("../module/apps/purpose-quick-view.mjs", import.meta.url)
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
    const keys = new Set(Array.from(source.matchAll(
        /(?:localize|format)(?:\(\s*|\s+)["']([^"']+)["']/g
    ), (match) => match[1]));
    for (const match of source.matchAll(/["'](GUM\.[A-Za-z0-9_.]+)["']/g)) keys.add(match[1]);
    return keys;
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
            templateSource: screen.template ? await readFile(screen.template, "utf8") : "",
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
    for (const key of [
        "Details", "Action", "NoDescription", "OpenReference", "Metadata", "Configured", "Empty", "SendToChat", "DetailsTitle",
        "ViewItemDetails", "ViewDetails", "SentToChat", "OpenDetailsFailure", "FillReference", "InvalidReference", "PdfNotFound",
        "ReferencesNotFound", "MissingReferences", "MultipleReferences", "ChooseReference"
    ]) {
        used.add(`GUM.PreviewDialog.${key}`);
    }
    for (const type of [
        "Equipment", "MeleeWeapon", "RangedWeapon", "Advantage", "Disadvantage", "Skill", "Spell", "Power", "Condition",
        "Modifier", "EquipmentModifier", "GMModifier", "Effect", "Trigger", "Template"
    ]) {
        used.add(`GUM.PreviewDialog.Types.${type}`);
    }
    for (const tag of [
        "Damage", "Range", "Parry", "Strength", "Accuracy", "RateOfFire", "Shots", "Recoil", "Attribute", "Level", "Group",
        "Class", "Casting", "Cost", "Activation", "Duration", "Points", "SelfControl", "TechLevel", "LegalityClass", "When",
        "Effects", "Effect", "Weight", "Tags", "Value", "SkillCap", "Category", "Type", "Code", "Quantity", "Reference"
    ]) {
        used.add(`GUM.PreviewDialog.Tags.${tag}`);
    }
    for (const key of flattenKeys(portuguese.GUM.RollPurposes)) used.add(`GUM.RollPurposes.${key}`);
    for (const key of flattenKeys(portuguese.GUM.RollTags)) used.add(`GUM.RollTags.${key}`);

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

test("preview dialog localization keys remain available", async () => {
    const portuguese = JSON.parse(await readFile(languagePaths["pt-BR"], "utf8"));
    const defined = new Set(flattenKeys(portuguese));
    const keys = [
        "Details", "Action", "NoDescription", "OpenReference", "Metadata", "Configured", "Empty", "SendToChat", "DetailsTitle",
        "ViewItemDetails", "ViewDetails", "SentToChat", "OpenDetailsFailure", "FillReference", "InvalidReference", "PdfNotFound",
        "ReferencesNotFound", "MissingReferences", "MultipleReferences", "ChooseReference"
    ];
    for (const key of keys) {
        assert.ok(defined.has(`GUM.PreviewDialog.${key}`), `missing preview dialog key: ${key}`);
    }
    for (const type of [
        "Equipment", "MeleeWeapon", "RangedWeapon", "Advantage", "Disadvantage", "Skill", "Spell", "Power", "Condition",
        "Modifier", "EquipmentModifier", "GMModifier", "Effect", "Trigger", "Template"
    ]) {
        assert.ok(defined.has(`GUM.PreviewDialog.Types.${type}`), `missing preview dialog type: ${type}`);
    }
    for (const tag of [
        "Damage", "Range", "Parry", "Strength", "Accuracy", "RateOfFire", "Shots", "Recoil", "Attribute", "Level", "Group",
        "Class", "Casting", "Cost", "Activation", "Duration", "Points", "SelfControl", "TechLevel", "LegalityClass", "When",
        "Effects", "Effect", "Weight", "Tags", "Value", "SkillCap", "Category", "Type", "Code", "Quantity", "Reference"
    ]) {
        assert.ok(defined.has(`GUM.PreviewDialog.Tags.${tag}`), `missing preview dialog tag: ${tag}`);
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

test("preview dialog reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "preview dialog");
    const fixedPortuguese = [
        "Equipamento", "Arma C. a C.", "Arma à Dist.", "Vantagem", "Desvantagem", "Perícia", "Condição", "Modificador",
        "Efeito", "Gatilho", "Modelo", "Detalhes", "Sem descrição.", "Abrir referência", "Metadados", "Ação", "Dano",
        "Alcance", "Aparar", "Nível", "Grupo", "Classe", "Custo", "Ativação", "Duração", "Pontos", "Quando", "Efeitos",
        "Peso", "Valor", "Categoria", "Código", "Configurado", "Vazio", "Enviar para o Chat", "Ver detalhes", "Enviado para o chat",
        "Não foi possível abrir", "Preencha o campo REF", "Formato de REF inválido", "Nenhum PDF com código",
        "Nenhuma das referências", "Não encontradas", "Múltiplas Referências", "Escolha qual referência"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!screen.scriptSource.includes(text), `fixed preview dialog text: ${text}`);
    }
});

test("preview dialog preserves mechanical types, item fields, chat payload and reference handling", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "preview dialog");
    for (const [type, key] of Object.entries({
        equipment: "Equipment", melee_weapon: "MeleeWeapon", ranged_weapon: "RangedWeapon", advantage: "Advantage",
        disadvantage: "Disadvantage", skill: "Skill", spell: "Spell", power: "Power", condition: "Condition",
        modifier: "Modifier", eqp_modifier: "EquipmentModifier", gm_modifier: "GMModifier", effect: "Effect",
        trigger: "Trigger", template: "Template"
    })) {
        assert.match(screen.scriptSource, new RegExp(`${type}: "GUM\\.PreviewDialog\\.Types\\.${key}"`));
    }
    const typeMapping = screen.scriptSource.split("const TYPE_LABEL_KEYS = {", 2)[1].split("};", 1)[0];
    assert.doesNotMatch(typeMapping, /game\.i18n/);
    assert.match(screen.scriptSource, /localizationKey \? localize\(localizationKey\) : \(type \? type\.toString\(\)\.toUpperCase\(\)/);
    for (const field of [
        "damage_formula", "damage_type", "reach", "parry", "min_strength", "accuracy", "range", "rof", "shots", "rcl",
        "base_attribute", "skill_level", "group", "spell_class", "casting_time", "duration", "mana_cost", "mana_maint",
        "activation_cost", "maint_cost", "points", "self_control_roll", "tech_level", "legality_class", "when", "effects",
        "cost", "level", "applied_effect", "cost_factor", "weight_mod", "tags", "modifier", "nh_cap", "ui_category", "code",
        "quantity", "total_weight", "total_cost", "ref"
    ]) {
        assert.match(screen.scriptSource, new RegExp(`\\b${field}\\b`), `missing preserved preview field: ${field}`);
    }
    assert.match(screen.scriptSource, /encodeURIComponent\(JSON\.stringify\(\{ title, type, img, description, tags, sourceUuid \}\)\)/);
    assert.match(screen.scriptSource, /style: CONST\.CHAT_MESSAGE_STYLES\.OTHER/);
    assert.match(screen.scriptSource, /const compactMatch = normalized\.match\(\/\^\(\[A-Z\]\+\)\(\\d\+\)\$\//);
    assert.match(screen.scriptSource, /parsed\.page \+ \(Number\(match\.pageOffset\) \|\| 0\)/);
    assert.match(screen.scriptSource, /missing\.map\(escapeHtml\)\.join\(", "\)/);
});

test("trigger sheet reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "trigger sheet");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    for (const text of [
        "Nome do Gatilho", "Gatilho", "Descrição", "Código", "Item de qualidade de vida", "Descrição Completa",
        "Descrição Resumida", "Salvar", "Expandir", "Cancelar"
    ]) {
        assert.ok(!templateSource.includes(text), `fixed trigger sheet text: ${text}`);
    }
});

test("trigger sheet preserves tabs, document fields and editor behavior", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "trigger sheet");
    for (const field of ["name", "system.code", "system.description", "system.chat_description"]) {
        assert.match(screen.templateSource, new RegExp(`(?:name|data-field|target|data-edit)="${field.replace(".", "\\.")}"`), `missing trigger field: ${field}`);
    }
    assert.match(screen.templateSource, /data-tab="detalhes"/);
    assert.match(screen.templateSource, /data-tab="codigo"/);
    assert.match(screen.templateSource, /engine="prosemirror"/);
    assert.match(screen.scriptSource, /await this\.item\.update\(\{ \[field\]: content \}\)/);
    assert.match(screen.scriptSource, /this\.item\.system\.description \|\| ""/);
    assert.match(screen.scriptSource, /this\.item\.system\.chat_description \|\| ""/);
});

test("condition builder reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "condition builder");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const scriptSource = screen.scriptSource.replace(/\/\/.*$/gm, "");
    for (const text of [
        "Assistente de Condições", "Selecionar Atributo", "Selecionar Operador de Comparação", "Selecionar Conector Lógico",
        "Geral do Personagem", "Itens e Equipamentos", "Vantagens e Desvantagens", "Status e Estados do Jogo",
        "Combate e Ambiente", "Selecionar Estrutura de Regra", "Qual tipo de habilidade?", "Salvar Fórmula"
    ]) {
        assert.ok(!`${templateSource}\n${scriptSource}`.includes(text), `fixed condition builder text: ${text}`);
    }
});

test("condition builder preserves formula values, paths, operators and insertion behavior", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "condition builder");
    const mappedAttributes = Array.from(screen.scriptSource.matchAll(/"([^"]+)": "GUM\.ConditionBuilder\.Attributes\.[^"]+"/g), match => match[1]).sort();
    assert.deepEqual(mappedAttributes, Object.keys(GUM_DATA.attributes).sort());
    for (const value of [
        "CAMINHO_DO_ATRIBUTO <= VALOR_OU_FÓRMULA",
        "actor.items.some(i => i.name === 'NOME_DO_ITEM')",
        "actor.items.some(i => i.type === 'armor' && i.system.location === 'equipped' && i.system.dr >= VALOR)",
        "actor.items.some(i => i.type === 'advantage' && i.name === 'NOME_DA_VANTAGEM')",
        "actor.items.some(i => i.type === 'disadvantage' && i.name === 'NOME_DA_DESVANTAGEM')",
        "actor.effects.some(e => e.getFlag('core', 'statusId') === 'prone')",
        "game.scenes.current.getFlag('gum', 'NOME_DA_FLAG') === true",
        "game.combat?.round >= NÚMERO_DA_RODADA"
    ]) {
        assert.ok(screen.scriptSource.includes(value), `missing preserved formula: ${value}`);
    }
    for (const operator of ["==", "!=", "<", "<=", ">", ">="]) {
        assert.match(screen.scriptSource, new RegExp(`"${operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}": "GUM\\.ConditionBuilder\\.Operators\\.`));
    }
    assert.match(screen.scriptSource, /const value = `\$\{valuePrefix\}\$\{key\}`/);
    assert.match(screen.scriptSource, /pickerData\.template\.replace\("'TYPE'", `'\$\{type\}'`\)/);
    assert.match(screen.scriptSource, /textarea\.value = textarea\.value\.substring\(0, start\) \+ text \+ textarea\.value\.substring\(end\)/);
    assert.match(screen.scriptSource, /this\.item\.update\(\{ "system\.when": formData\["system\.when"\] \}\)/);
    assert.match(screen.templateSource, /name="system\.when"/);
});

test("condition sheet reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "condition sheet");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const scriptSource = screen.scriptSource.replace(/\/\/.*$/gm, "");
    for (const text of [
        "Nome da Condição", "Descrição Resumida", "Descrição Completa", "Regra de ativação", "Modo da condição",
        "Vínculo de Status", "Status vinculado", "Empilhamento", "Atualizar duração", "Limite de stacks",
        "Efeitos Vinculados", "Nenhum efeito vinculado", "Link Quebrado", "UUID não encontrado", "Efeito desconhecido",
        "Preencha o campo REF", "Formato de REF inválido", "Múltiplas Referências"
    ]) {
        assert.ok(!`${templateSource}\n${scriptSource}`.includes(text), `fixed condition sheet text: ${text}`);
    }
});

test("condition sheet preserves binding modes, linked effects, editors and PDF references", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "condition sheet");
    for (const field of [
        "name", "system.ref", "system.chat_description", "system.description", "system.bindingMode",
        "system.statusBinding.statusId", "system.statusBinding.stackMode", "system.statusBinding.stackLimit",
        "system.statusBinding.enabled", "system.statusBinding.removeOnStatusOff", "system.when",
        "system.triggerOnTurnStartWhileActive"
    ]) {
        assert.match(screen.templateSource, new RegExp(`(?:name|data-field|target|data-edit)="${field.replaceAll(".", "\\.")}"`), `missing condition field: ${field}`);
    }
    for (const value of ["conditional", "status-link", "refresh", "replace", "stack"]) {
        assert.match(screen.templateSource, new RegExp(`value="${value}"`));
    }
    assert.match(screen.scriptSource, /const effectLinks = this\.item\.system\.effects \|\| \[\]/);
    assert.match(screen.scriptSource, /const effectItem = await fromUuid\(link\.uuid\)/);
    assert.match(screen.scriptSource, /effects\.splice\(effectIndex, 1\)/);
    assert.match(screen.scriptSource, /this\.item\.update\(\{ "system\.effects": effects \}\)/);
    assert.match(screen.scriptSource, /await this\.item\.update\(\{ \[field\]: content \}\)/);
    assert.match(screen.scriptSource, /part\.replace\(\/\\s\+\/g, ""\)\.match\(\/\^\(\[A-Z\]\+\)\(\\d\+\)\$\//);
    assert.match(screen.scriptSource, /parsed\.page \+ \(Number\(match\.pageOffset\) \|\| 0\)/);
    assert.match(screen.scriptSource, /missing\.map\(escapeHtml\)\.join\(", "\)/);
});

test("effect sheet header and description have no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "effect sheet description");
    const headerAndTabs = screen.templateSource.split('<main class="sheet-body">', 1)[0];
    const descriptionTab = screen.templateSource
        .split('<div class="tab active" data-tab="description" data-group="primary">', 2)[1]
        .split('<div class="tab" data-tab="configuracao" data-group="primary">', 1)[0];
    const referenceFlow = screen.scriptSource.split("    async _onOpenReferenceLink", 2)[1];
    const scopedSource = `${headerAndTabs}\n${descriptionTab}\n${referenceFlow}`
        .replace(/{{!--[\s\S]*?--}}/g, "")
        .replace(/\/\/.*$/gm, "");

    for (const text of [
        "Nome do Item", "Descrição Resumida", "Descrição Completa", "Livro e Página de Referência",
        "Abrir Referência", "Salvar", "Expandir", "Cancelar", "Preencha o campo REF",
        "Formato de REF inválido", "Nenhum PDF com código", "Nenhuma das referências informadas",
        "Não encontradas", "Múltiplas Referências", "Escolha qual referência"
    ]) {
        assert.ok(!scopedSource.includes(text), `fixed effect sheet description text: ${text}`);
    }
});

test("effect sheet description preserves tabs, fields, editors and PDF references", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "effect sheet description");
    for (const tab of ["description", "configuracao", "efeitos-ativos"]) {
        assert.match(screen.templateSource, new RegExp(`data-tab="${tab}"`));
    }
    for (const field of ["name", "system.ref", "system.chat_description", "system.description"]) {
        assert.match(screen.templateSource, new RegExp(`(?:name|data-field|target|data-edit)="${field.replaceAll(".", "\\.")}"`), `missing effect field: ${field}`);
    }
    assert.match(screen.templateSource, /engine="prosemirror"/);
    assert.match(screen.scriptSource, /await this\.item\.update\(\{ \[field\]: content \}\)/);
    assert.match(screen.scriptSource, /part\.replace\(\/\\s\+\/g, ""\)\.match\(\/\^\(\[A-Z\]\+\)\(\\d\+\)\$\//);
    assert.match(screen.scriptSource, /parsed\.page \+ \(Number\(match\.pageOffset\) \|\| 0\)/);
    assert.match(screen.scriptSource, /missing\.map\(escapeHtml\)\.join\(", "\)/);
});

test("effect sheet configuration has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "effect sheet description");
    const configurationTab = screen.templateSource
        .split('<div class="tab" data-tab="configuracao" data-group="primary">', 2)[1]
        .split("    </main>", 1)[0];
    const getDataFlow = screen.scriptSource
        .split("    async getData(options)", 2)[1]
        .split("    _captureExpansionState()", 1)[0];
    const scopedSource = `${configurationTab}\n${getDataFlow}`
        .replace(/{{!--[\s\S]*?--}}/g, "")
        .replace(/\/\/.*$/gm, "");

    for (const text of [
        "Ícone no Token", "Automático (temporário mostra / permanente oculta)", "Sempre mostrar no token",
        "Nunca mostrar no token", "Acúmulo por Condições", "Acumular normalmente", "Não acumular entre condições",
        "Barreira de Resistência", "Ativar registro de barreira", "Texto no card de resistência", "Aplicar efeito em",
        "Em Falha", "Em Sucesso", "Margem Min", "Finalidades do teste", "Selecionar finalidades",
        "Realizar o teste automaticamente", "Duração do Efeito", "Temporária/Combate", "Efeitos Passivos",
        "Início da contagem", "Ao aplicar", "No início do próximo turno", "Rodadas (seg)", "Fim da contagem",
        "No início do turno final", "No fim do turno final"
    ]) {
        assert.ok(!scopedSource.includes(text), `fixed effect sheet configuration text: ${text}`);
    }
});

test("effect sheet configuration preserves policies, resistance and duration mechanics", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "effect sheet description");
    for (const field of [
        "system.tokenIconPolicy", "system.conditionStackingMode", "system.resistanceRoll.isResisted",
        "system.resistanceRoll.chatText", "system.resistanceRoll.applyOn", "system.resistanceRoll.attribute",
        "system.resistanceRoll.margin", "system.resistanceRoll.modifier", "system.resistanceRoll.requestedPurposeIds",
        "system.resistanceRoll.skipPromptCard", "system.duration._uiMode", "system.duration.isPermanent",
        "system.duration.inCombat", "system.duration.startMode", "system.duration.value", "system.duration.endMode"
    ]) {
        assert.match(screen.templateSource, new RegExp(`name="${field.replaceAll(".", "\\.")}"`), `missing effect configuration field: ${field}`);
    }
    for (const value of [
        "auto", "always", "never", "stack", "unique", "failure", "success", "permanent", "combat",
        "apply", "nextTurnStart", "turnStart", "turnEnd"
    ]) {
        assert.ok(`${screen.templateSource}\n${screen.scriptSource}`.includes(`"${value}"`), `missing preserved configuration value: ${value}`);
    }
    assert.match(screen.scriptSource, /const resistancePurposeIds = normalizePurposeIds\(context\.system\.resistanceRoll\?\.requestedPurposeIds\)/);
    assert.match(screen.scriptSource, /"system\.duration\._uiMode": mode/);
    assert.match(screen.scriptSource, /"system\.duration\.isPermanent": isPermanent/);
    assert.match(screen.scriptSource, /"system\.duration\.inCombat": inCombat/);
});

test("effect sheet actions reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "effect sheet description");
    const actionsTab = screen.templateSource
        .split('<div class="tab" data-tab="efeitos-ativos" data-group="primary">', 2)[1]
        .split('<div class="tab active" data-tab="description" data-group="primary">', 1)[0];
    const scopedSource = `${actionsTab}\n${screen.scriptSource}`
        .replace(/{{!--[\s\S]*?--}}/g, "")
        .replace(/{{![\s\S]*?}}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

    for (const text of [
        "Ações do Efeito", "Configure os resultados", "Adicionar Ação", "Remover ação", "Nome do efeito aplicado",
        "Nome exibido na ficha", "Modificador de Atributo", "Alteração de Recurso", "Criar Recurso",
        "Modificador de Rolagem", "Mensagem de Chat", "Valor ou expressão", "Escalonamento do valor",
        "Ícone de Status", "Pontos de Vida", "Pontos de Fadiga", "Registro de Combate", "Pedir confirmação",
        "Entrada adicional", "Descrição na Janela de Rolagem", "Aplicar o modificador em", "Selecionar contextos",
        "Marcadores de finalidade", "Restrições específicas", "Nome da Macro", "Configuração do Teste",
        "Nenhuma ação configurada", "Selecionar Contextos", "Tag personalizada", "Nenhum marcador encontrado"
    ]) {
        assert.ok(!scopedSource.includes(text), `fixed effect sheet actions text: ${text}`);
    }
});

test("effect sheet actions preserve action types, fields, contexts and stored values", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "effect sheet description");
    const combined = `${screen.templateSource}\n${screen.scriptSource}`;
    for (const type of ["attribute", "status", "resource_change", "resource_create", "roll_modifier", "chat", "macro", "flag"]) {
        assert.match(screen.templateSource, new RegExp(`value="${type}"`), `missing effect action type: ${type}`);
    }
    for (const field of [
        "label", "type", "path", "operation", "value", "value_mode", "statusId", "category", "name", "chat_notice",
        "confirm_prompt", "variable_value", "exists_policy", "source", "max", "hidden", "chat_text", "has_roll",
        "roll_label", "roll_attribute", "roll_modifier", "requestedPurposeIds", "key", "flag_value"
    ]) {
        assert.match(screen.templateSource, new RegExp(`name="system\\.actions\\.\{\{action\\.index\}\}\\.${field}"`), `missing action field: ${field}`);
    }
    for (const value of [
        "ADD", "OVERRIDE", "fixed", "per_origin_level", "hp", "fp", "energy_reserve", "combat_tracker",
        "item_quantity", "spell_reserve", "power_reserve", "ignore", "update_max", "sum_max", "replace", "restore",
        "any", "all", "roll_only", "include_in_nh", "self", "vs_targeter"
    ]) {
        assert.ok(combined.includes(`"${value}"`), `missing preserved effect action value: ${value}`);
    }
    const contextIds = Array.from(screen.scriptSource.matchAll(/\{ id: "([^"]+)", labelKey: "GUM\.EffectSheet\.Actions\.ContextsCatalog\./g), match => match[1]);
    assert.deepEqual(contextIds, [
        "all", "attack", "attack_melee", "attack_ranged", "defense", "defense_dodge", "defense_parry", "defense_block",
        "skill", "spell", "power", "sense_vision", "sense_hearing", "sense_tastesmell", "sense_touch", "check_st",
        "skill_st", "check_dx", "skill_dx", "check_iq", "skill_iq", "check_ht", "skill_ht", "check_per", "skill_per",
        "check_vont", "skill_vont"
    ]);
    assert.match(screen.scriptSource, /actions\.push\(normalizeAction\(\{\}\)\)/);
    assert.match(screen.scriptSource, /actions\.splice\(index, 1\)/);
    assert.match(screen.scriptSource, /normalizeRollTags\(dlgHtml\.find\('input\[name="roll-tag"\]:checked'\)/);
});

test("roll purpose catalogs provide localized labels for every mechanical id", async () => {
    const languages = Object.fromEntries(await Promise.all(Object.entries(languagePaths).map(
        async ([language, path]) => [language, JSON.parse(await readFile(path, "utf8"))]
    )));
    for (const language of Object.values(languages)) {
        const catalog = language.GUM.RollPurposes;
        assert.deepEqual(Object.keys(catalog.Groups).sort(), ROLL_PURPOSE_GROUPS.map(group => group.id).sort());
        assert.deepEqual(Object.keys(catalog.Purposes).sort(), ROLL_PURPOSES.map(purpose => purpose.id).sort());
        for (const purpose of ROLL_PURPOSES) assert.ok(catalog.Purposes[purpose.id].Label?.trim(), `missing purpose label: ${purpose.id}`);
    }
});

test("roll tag catalogs provide localized labels for every mechanical id", async () => {
    const languages = Object.fromEntries(await Promise.all(Object.entries(languagePaths).map(
        async ([language, path]) => [language, JSON.parse(await readFile(path, "utf8"))]
    )));
    const expectedTags = ROLL_TAG_CATALOG.map(tag => tag.id.replaceAll(".", "_")).sort();
    for (const language of Object.values(languages)) {
        const catalog = language.GUM.RollTags;
        assert.deepEqual(Object.keys(catalog.Groups).sort(), ROLL_TAG_GROUPS.map(group => group.id).sort());
        assert.deepEqual(Object.keys(catalog.Tags).sort(), expectedTags);
        for (const label of Object.values(catalog.Tags)) assert.ok(label?.trim(), "missing roll tag label");
    }
});

test("shared purpose picker and quick view have no fixed Portuguese UI text", async () => {
    const screensByName = new Map((await readScreenSources()).map(screen => [screen.name, screen.scriptSource.replace(/\/\/.*$/gm, "")]));
    const scopedSource = `${screensByName.get("roll purpose picker")}\n${screensByName.get("purpose quick view")}`;
    for (const text of [
        "Buscar finalidade por nome", "Mostrar somente selecionadas", "Nenhuma finalidade encontrada",
        "Selecionar finalidades do teste", "Aplicar como Teste Geral", "Finalidade principal",
        "Qualificadores podem ser combinados", "Base comum", "Quando usar", "Não confundir com",
        "Tag recomendada para efeitos", "Tags específicas produzidas", "Categorias herdadas",
        "Não foi possível copiar a tag"
    ]) {
        assert.ok(!scopedSource.includes(text), `fixed shared purpose UI text: ${text}`);
    }
});

test("template item sheet reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(entry => entry.name === "template item sheet");
    const reachable = `${screen.templateSource}\n${screen.scriptSource.replace(/\/\/.*$/gm, "")}`;
    for (const text of [
        "Nome do Modelo", "Descrição Resumida", "Descrição Completa", "Adicionar bloco", "Editar bloco", "Remover bloco",
        "Título customizado", "Quantidade a escolher", "Pontos disponíveis", "Arraste perícias", "Nenhum bloco criado",
        "Adicionar Atributo", "Adicionar Subgrupo", "Nome do Subgrupo", "Notas locais", "Custo exibido",
        "JSON inválido", "Editar Item do Bloco", "Esse tipo de item não pode ser usado"
    ]) assert.ok(!reachable.includes(text), `fixed template item sheet UI text: ${text}`);
});

test("template item sheet preserves block, entry, attribute and difficulty mechanics", async () => {
    const screen = (await readScreenSources()).find(entry => entry.name === "template item sheet");
    const combined = `${screen.templateSource}\n${screen.scriptSource}`;
    for (const value of [
        "guaranteed", "selection", "points", "choiceCount", "pointsAvailable", "contents", "collapsed",
        "skill", "spell", "power", "advantage", "disadvantage", "equipment", "attribute", "group",
        "st", "dx", "iq", "ht", "will", "per", "hp", "fp", "basic_speed", "move",
        "E", "A", "H", "VH", "F", "M", "D", "MD", "TecM", "TecD"
    ]) assert.ok(new RegExp(`\\b${value}\\b`).test(combined) || combined.includes(`data-field="${value}"`), `missing template mechanic: ${value}`);
    assert.match(screen.scriptSource, /this\.item\.update\(\{ "system\.blocks": blocks \}\)/);
    assert.match(screen.scriptSource, /TextEditor\.getDragEventData\(event\)/);
    assert.match(screen.scriptSource, /JSON\.parse\(subBlocksRaw\)/);
    assert.match(screen.templateSource, /name="system\.chat_description"|target="system\.chat_description"/);
    assert.match(screen.templateSource, /name="system\.description"|target="system\.description"/);
});

test("damage application reachable flow has no fixed Portuguese UI text", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "damage application");
    const templateSource = screen.templateSource.replace(/{{!--[\s\S]*?--}}/g, "");
    const scriptSource = screen.scriptSource
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
    const fixedPortuguese = [
        "Aplicar Dano", "Ponto de Impacto", "Situações Especiais", "Aplicar Apenas Efeitos",
        "Aplicar como Cura", "Dano de Explosão", "Aplicar Choque", "Tolerância a Ferimentos",
        "Peso da Defesa", "Apenas Projeção", "Efeitos a serem aplicados", "Propor Testes",
        "Teste de Resistência", "Resumo do Ataque", "Efeitos Pendentes", "Nenhum efeito adicional"
    ];

    for (const text of fixedPortuguese) {
        assert.ok(!templateSource.includes(text), `fixed damage application template text: ${text}`);
        assert.ok(!scriptSource.includes(text), `fixed reachable damage application script text: ${text}`);
    }
});

test("damage application preserves mechanical values and calculation rules", async () => {
    const screen = (await readScreenSources()).find(({ name }) => name === "damage application");

    for (const value of ["nao-vivo", "homogeneo", "difuso", "one-handed", "two-handed", "normal", "cheap", "fine", "veryFine"]) {
        assert.match(screen.templateSource, new RegExp(`value="${value}"`));
    }
    for (const field of [
        "damage_target_pool", "large_area_injury", "ignore_dr", "wounding_mod_type", "special_apply_effects_only",
        "special_apply_as_heal", "special_half_damage", "special_explosion", "special_apply_shock", "special_only_knockback",
        "tolerance_type", "damage_reduction_enabled", "damage_reduction_value", "damage_rolled", "armor_divisor", "target_dr"
    ]) {
        assert.match(screen.templateSource, new RegExp(`name="${field}"`));
    }
    for (const abbreviation of ["cort", "perf", "cont", "qmd", "cor", "tox", "pi", "pi-", "pi+", "pi++"]) {
        assert.match(screen.scriptSource, new RegExp(`abrev: "${abbreviation.replace(/[+]/g, "\\+")}"`));
    }
    assert.match(screen.scriptSource, /Math\.floor\(selectedLocationDR \/ armorDivisor\)/);
    assert.match(screen.scriptSource, /Math\.floor\(penetratingDamage \* woundingMod\)/);
    assert.match(screen.scriptSource, /Math\.floor\(finalInjury \/ damageReductionValue\)/);
    assert.match(screen.scriptSource, /Math\.ceil\(\(torsoDR \+ markedDR\) \/ 2\)/);
    assert.match(screen.scriptSource, /system\.attributes\.hp\.value/);
    assert.match(screen.scriptSource, /system\.attributes\.fp\.value/);
    assert.match(screen.scriptSource, /system\.spell_reserves\.\$\{key\}/);
    assert.match(screen.scriptSource, /system\.power_reserves\.\$\{key\}/);
    assert.match(screen.scriptSource, /this\._localizedBodyLocationLabel\(key, data\)/);
    assert.match(screen.scriptSource, /BODY_LOCATION_LABEL_KEYS\[baseKey\]/);
    assert.match(screen.scriptSource, /BODY_LOCATION_GROUP_KEYS\[groupKey\]/);
    assert.match(screen.scriptSource, /type: "damage"/);
    assert.match(screen.scriptSource, /specialEffect: "shock"/);
});
