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
    return Promise.all(screens.map(async (screen) => ({
        ...screen,
        templateSource: await readFile(screen.template, "utf8"),
        scriptSource: await readFile(screen.script, "utf8")
    })));
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
