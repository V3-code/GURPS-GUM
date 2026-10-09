import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const recalculationTemplate = readFileSync(new URL("../templates/apps/secondary-stats-recalculation.hbs", import.meta.url), "utf8");
const recalculationUtility = readFileSync(new URL("../module/utils/secondary-stats-recalculation.mjs", import.meta.url), "utf8");
const locales = [
  JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8")),
  JSON.parse(readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8")),
];

const sidebar = template.slice(template.indexOf('<aside class="sheet-sidebar">'), template.indexOf('{{! MACRORREGIÃO 3:'));
const editor = actorSheet.slice(actorSheet.indexOf("// EDITOR UNIFICADO DE ATRIBUTOS SECUNDÁRIOS"), actorSheet.indexOf("// QUICK VIEW ORIGIN"));
const recalculation = [actorSheet, recalculationTemplate, recalculationUtility].join("\n");

const collectKeys = source => new Set(
  [...source.matchAll(/GUM\.(?:Character\.Sidebar|SecondaryEditor|SecondaryRecalculation)(?:\.[A-Za-z0-9]+)+/g)]
    .map(match => match[0])
    .filter(key => !["GUM.Character.Sidebar.EncumbranceLevels", "GUM.SecondaryEditor.Column"].includes(key)),
);

test("the character sidebar delegates visible copy and roll labels to localization", () => {
  assert.match(sidebar, /GUM\.Character\.Sidebar\.SecondaryAttributes/);
  assert.match(sidebar, /GUM\.Character\.Sidebar\.EncumbranceLevel/);
  assert.match(sidebar, /GUM\.Character\.Sidebar\.BasicDamage/);
  assert.match(sidebar, /GUM\.Character\.Sidebar\.Survival/);
  assert.doesNotMatch(sidebar, />\s*(?:ATRIBUTOS SECUNDÁRIOS|PONTOS DE VIDA|PONTOS DE FADIGA|SOBREVIVÊNCIA|FOME|SEDE|SONO|RADIAÇÃO)\s*</i);
  assert.match(actorSheet, /context\.encumbranceLevelLabel = game\.i18n\.localize/);
});

test("the active secondary editor and recalculation flow contain no fixed interface copy", () => {
  assert.match(editor, /GUM\.SecondaryEditor\.DialogTitle/);
  assert.match(editor, /GUM\.SecondaryEditor\.Attributes\.BasicSpeed/);
  assert.match(editor, /GUM\.SecondaryEditor\.Save/);
  assert.doesNotMatch(editor, /title: "Editar Atributos Secundários"|label: "Salvar alterações"|>Mobilidade e defesa<|>Força de levantamento</);
  assert.match(recalculationTemplate, /GUM\.SecondaryRecalculation\.Intro/);
  assert.match(actorSheet, /GUM\.SecondaryRecalculation\.ApplyCount/);
});

test("all sidebar and secondary attribute localization keys exist in both languages", () => {
  const keys = new Set([...collectKeys(sidebar), ...collectKeys(editor), ...collectKeys(recalculation)]);
  for (let level = 0; level <= 4; level += 1) keys.add(`GUM.Character.Sidebar.EncumbranceLevels.${level}`);
  for (const column of ["Base", "Maximum", "Fixed", "Items", "Temporary", "Points", "Final"]) {
    keys.add(`GUM.SecondaryEditor.Column.${column}`);
  }

  for (const key of keys) {
    for (const locale of locales) {
      const isDynamicNamespace = Object.keys(locale).some(candidate => candidate.startsWith(`${key}.`));
      if (isDynamicNamespace) continue;
      assert.equal(typeof locale[key], "string", `missing ${key}`);
    }
  }
});
