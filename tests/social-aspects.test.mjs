import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOCIAL_CATEGORIES, buildSocialSections, calculateManualSocialPoints } from "../module/config/social-aspects.mjs";

const item = (id, contributions) => ({ id, type: "advantage", name: "Aliados", img: "ally.webp", system: { points: 10, social_contributions: contributions } });
test("supports multiple contributions and combines legacy manual records", () => {
  const system = { language_entries: { old: { language_name: "Comum", points: 2 } } };
  const sections = buildSocialSections(system, [item("a", { one: { type: "language", language_name: "Élfico", points: 99 }, two: { type: "bond", name: "Guilda" } })]);
  assert.equal(sections.find(s => s.type === "language").count, 2);
  assert.equal(sections.find(s => s.type === "bond").count, 1);
  assert.equal(calculateManualSocialPoints(system), 2, "item contributions never duplicate points");
});
test("derived records disappear with their item and retain source navigation", () => {
  const withItem = buildSocialSections({}, [item("source", { one: { type: "wealth", wealth_level: "Rico" } })]);
  assert.equal(withItem.find(s => s.type === "wealth").entries[0].itemId, "source");
  assert.equal(buildSocialSections({}, []).find(s => s.type === "wealth").count, 0);
});
test("reputations share the reaction group without a duplicate section", () => {
  const sections = buildSocialSections({ reputation_entries: {
    rep: { title: "Herói", reaction_modifier: 2, scope: "Cidade" },
    pending: { title: "Desconhecido", reaction_modifier: "", scope: "Guilda" }
  } });
  const reactions = sections.find(s => s.type === "reaction");
  assert.equal(reactions.count, 2);
  assert.ok(reactions.entries.every(entry => entry.type === "reputation"));
  assert.equal(sections.some(s => s.type === "reputation"), false);
});

test("item sheet presents social aspects after details with card fields", () => {
  const template = readFileSync(new URL("../templates/items/item-sheet.hbs", import.meta.url), "utf8");
  const navigation = template.slice(template.indexOf('<nav class="sheet-tabs tabs"'), template.indexOf("</nav>"));

  assert.ok(navigation.indexOf('data-tab="details"') < navigation.indexOf('data-tab="social"'));
  assert.match(template, /item-social-field-card item-social-type-field/);
  assert.match(template, /item-social-common-row/);
  assert.match(template, /social_contributions\.\{\{id\}\}\.points/);
  assert.match(template, /class="item-social-field-control"/);
  assert.match(template, /<\/summary>\s*<button type="button" class="delete-item-social item-social-delete"/);
  assert.match(template, /data-id="\{\{id\}\}" \{\{#if open\}\}open\{\{\/if\}\}/);
});

test("social contribution schemas preserve the requested field rows", () => {
  const layout = type => SOCIAL_CATEGORIES[type].fields
    .filter(([name]) => name !== "points")
    .map(([name, , , options]) => [name, options?.row, Boolean(options?.compact), Boolean(options?.wide)]);

  assert.deepEqual(layout("status"), [["society", 1, false, true], ["level", 2, true, false], ["status_name", 2, false, false], ["monthly_cost", 2, false, false], ["description", 3, false, true]]);
  assert.deepEqual(layout("culture"), [["level", 1, true, false], ["culture_name", 1, false, false], ["description", 2, false, true]]);
  assert.deepEqual(layout("language"), [["language_name", 1, false, true], ["spoken_level", 2, false, false], ["written_level", 2, false, false], ["description", 3, false, true]]);
  assert.deepEqual(layout("wealth"), [["wealth_level", 1, false, true], ["effects", 2, false, true]]);
  assert.deepEqual(layout("bond"), [["name", 1, false, false], ["bond_type", 1, false, false], ["description", 2, false, true]]);
  assert.deepEqual(layout("reputation").map(([name, row]) => [name, row]), [["reaction_modifier", 1], ["title", 1], ["scope", 2], ["circumstance", 2], ["recognition_frequency", 2], ["notes", 3]]);
  assert.deepEqual(layout("reaction").map(([name, row]) => [name, row]), [["value", 1], ["title", 1], ["audience", 2], ["circumstance", 2], ["recognition_frequency", 2], ["notes", 3]]);
});

test("status and organization use society as identity and status as a metric", () => {
  const labels = {
    "GUM.Social.Fields.Level": "Nível",
    "GUM.Social.Fields.Status": "Status",
    "GUM.Social.Fields.MonthlyCost": "Custo mensal",
    "GUM.Social.Fields.Salary": "Salário",
    "GUM.Social.Manual": "Manual"
  };
  const system = {
    social_status_entries: {
      imperial: {
        society: "Império Kalashtar",
        status_name: "Cidadão Livre",
        level: 0,
        monthly_cost: "-200",
        description: "Reconhecido nos distritos centrais."
      }
    },
    organization_entries: {
      guild: {
        organization_name: "Guilda Alquimista",
        status_name: "Aprendiz",
        level: 1,
        salary: "650",
        description: "Membro em treinamento."
      }
    }
  };
  const sections = buildSocialSections(system, [], key => labels[key] ?? key);
  const entry = sections.find(section => section.type === "status").entries[0];
  const organization = sections.find(section => section.type === "organization").entries[0];

  assert.equal(entry.primary, "Império Kalashtar");
  assert.equal(entry.context, "");
  assert.deepEqual(entry.metrics, [
    { key: "level", label: "Nível", value: 0, tone: "default" },
    { key: "status_name", label: "Status", value: "Cidadão Livre", tone: "default" },
    { key: "monthly_cost", label: "Custo mensal", value: "-200", tone: "default" }
  ]);
  assert.equal(entry.observation, "Reconhecido nos distritos centrais.");
  assert.equal(entry.sourceLabel, "Manual");
  assert.equal(organization.primary, "Guilda Alquimista");
  assert.equal(organization.context, "");
  assert.deepEqual(organization.metrics, [
    { key: "level", label: "Nível", value: 1, tone: "default" },
    { key: "status_name", label: "Status", value: "Aprendiz", tone: "default" },
    { key: "salary", label: "Salário", value: "650", tone: "default" }
  ]);
  assert.equal(organization.observation, "Membro em treinamento.");
});

test("actor social template keeps the source image at left and observations in a conditional footer", () => {
  const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

  assert.match(template, /class="social-entry-portrait \{\{source\}\}"/);
  assert.match(template, /class="social-entry-primary"/);
  assert.match(template, /class="social-entry-metrics"/);
  assert.match(template, /\{\{#if observation\}\}<div class="social-entry-observation"/);
  assert.doesNotMatch(template, /class="social-origin /);
  assert.match(styles, /\.tab\[data-tab="social"\] \.social-entry-list > \.social-entry-card \{ display:block;/);
});

test("manual social dialogs use the shared dark editor presentation", () => {
  const source = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

  assert.match(source, /class="gum-social-category-form"/);
  assert.match(source, /class="gum-social-dialog-intro"/);
  assert.match(source, /gum-sheet-edit-dialog", "gum-social-category-dialog/);
  assert.match(source, /gum-sheet-edit-dialog", "gum-social-edit-dialog/);
  assert.match(styles, /\.dialog\.gum\.gum-social-category-dialog \.window-header/);
  assert.match(styles, /button\[data-button="save"\]/);
  assert.match(styles, /button\[data-button="add"\]/);
});

test("captures social contribution state before Foundry rerenders", () => {
  const source = readFileSync(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8");

  assert.ok(source.includes('querySelectorAll(".item-social-contribution[data-id]")'));
  assert.ok(source.includes("this._socialContributionOpenState.set(id, contribution.open)"));

  const renderStart = source.lastIndexOf("async _render(force, options)");
  const superRender = source.indexOf("await super._render(force, options);", renderStart);
  const captureCall = source.indexOf("this._captureSocialContributionOpenState();", renderStart);

  assert.ok(renderStart >= 0);
  assert.ok(captureCall > renderStart && captureCall < superRender, "the live DOM state must be captured before super._render replaces it");
});


test("generic details restoration cannot reopen a different social contribution", () => {
  const source = readFileSync(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /querySelectorAll\(['"]details\[open\]['"]\)\.forEach\(\(el, i\)/);
  assert.ok(source.includes('element.matches(".item-social-contribution[data-id]")'));
  assert.match(source, /details\.flatMap\(\(element, index\)[\s\S]*return \[\{ id: element\.id \|\| null, index \}\]/);
});
