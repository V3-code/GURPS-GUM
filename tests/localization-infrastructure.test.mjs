import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestPath = new URL("../system.json", import.meta.url);
const templatePath = new URL("../templates/apps/damage-roll-prompt.hbs", import.meta.url);
const scriptPath = new URL("../module/apps/damage-roll-prompt.js", import.meta.url);
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

test("pilot references every localization key and only defined keys", async () => {
    const [template, script, portuguese] = await Promise.all([
        readFile(templatePath, "utf8"),
        readFile(scriptPath, "utf8"),
        readFile(languagePaths["pt-BR"], "utf8").then(JSON.parse)
    ]);
    const defined = new Set(flattenKeys(portuguese));
    const used = new Set([...directLocalizationKeys(template), ...directLocalizationKeys(script)]);

    for (const section of ["main", "followUp", "fragmentation"]) {
        used.add(`GUM.DamageRollPrompt.Sections.${section}`);
    }

    assert.deepEqual([...used].sort(), [...defined].sort());
});

test("pilot Handlebars expressions and blocks are balanced", async () => {
    const template = await readFile(templatePath, "utf8");
    assert.equal((template.match(/{{/g) || []).length, (template.match(/}}/g) || []).length);

    const blocks = [];
    for (const match of template.matchAll(/{{([#/])\s*([\w-]+)/g)) {
        if (match[1] === "#") blocks.push(match[2]);
        else assert.equal(blocks.pop(), match[2], `unbalanced Handlebars block: ${match[2]}`);
    }
    assert.deepEqual(blocks, []);
});
