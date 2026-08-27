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
