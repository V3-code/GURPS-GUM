import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CONTENT_SOURCE_PURPOSES } from "../module/services/content-source-service.mjs";

const languages = ["en", "pt-BR"];
const catalogs = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(fs.readFileSync(`lang/${language}.json`, "utf8"))
]));

test("content source names and descriptions are available in every supported language", () => {
  for (const definition of Object.values(CONTENT_SOURCE_PURPOSES)) {
    for (const language of languages) {
      assert.ok(catalogs[language][definition.label], `${definition.label} is missing from ${language}`);
      assert.ok(catalogs[language][definition.description], `${definition.description} is missing from ${language}`);
    }
  }
});

test("the four distributed pack names are available in every supported language", () => {
  const manifest = JSON.parse(fs.readFileSync("system.json", "utf8"));
  assert.equal(manifest.packs.length, 4);
  for (const pack of manifest.packs) {
    for (const language of languages) {
      assert.ok(catalogs[language][pack.label], `${pack.label} is missing from ${language}`);
    }
  }
});

test("status automation is the localized public name while stable binding IDs remain unchanged", () => {
  assert.equal(catalogs.en["GUM.ContentSources.Purposes.StatusAutomations.Name"], "Status Automations");
  assert.equal(catalogs["pt-BR"]["GUM.ContentSources.Purposes.StatusAutomations.Name"], "Automações de Status");
  assert.ok(CONTENT_SOURCE_PURPOSES.statusBindings);
  assert.equal(CONTENT_SOURCE_PURPOSES.statusBindings.defaults[0], "gum.status_bindings");
});
