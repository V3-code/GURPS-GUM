import test from "node:test";
import assert from "node:assert/strict";
import { buildSocialSections, calculateManualSocialPoints } from "../module/config/social-aspects.mjs";

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