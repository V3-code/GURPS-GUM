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
test("reputation modifier is projected into reaction summary", () => {
  const sections = buildSocialSections({ reputation_entries: { rep: { title: "Herói", reaction_modifier: 2, scope: "Cidade" } } });
  const reactions = sections.find(s => s.type === "reaction");
  assert.equal(reactions.count, 1);
assert.equal(reactions.entries[0].type, "reputation");
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
  assert.deepEqual(layout("language"), [["spoken_level", 1, false, false], ["written_level", 1, false, false], ["description", 2, false, true]]);
  assert.deepEqual(layout("wealth"), [["wealth_level", 1, false, true], ["effects", 2, false, true]]);
  assert.deepEqual(layout("bond"), [["name", 1, false, false], ["bond_type", 1, false, false], ["description", 2, false, true]]);
  assert.deepEqual(layout("reputation").map(([name, row]) => [name, row]), [["reaction_modifier", 1], ["title", 1], ["scope", 2], ["circumstance", 2], ["recognition_frequency", 2], ["notes", 3]]);
  assert.deepEqual(layout("reaction").map(([name, row]) => [name, row]), [["value", 1], ["title", 1], ["audience", 2], ["circumstance", 2], ["recognition_frequency", 2], ["notes", 3]]);
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
