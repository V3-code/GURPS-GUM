import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");

test("group deletion uses a promise-backed confirmation compatible with the legacy sheet", () => {
  assert.match(actorSheet, /_confirmSkillOrganizationAction\([\s\S]*new Promise\(resolve/);
  assert.match(actorSheet, /_deleteSkillOrganizationGroup[\s\S]*await this\._confirmSkillOrganizationAction/);
  assert.doesNotMatch(actorSheet, /_deleteSkillOrganizationGroup[\s\S]{0,500}Dialog\.confirm/);
});

test("category suggestions show a selectable preview before changing organization", () => {
  assert.match(actorSheet, /buildItemCategoryGroupPlan\(organization, skills\)/);
  assert.match(actorSheet, /_promptSkillCategoryGroupPlan\(plan\)/);
  assert.match(actorSheet, /input type="checkbox" name="category"/);
  assert.match(actorSheet, /createGroupsFromItemCategories\(organization, skills, createId, selectedCategories\)/);
});

test("the remove action moves a grouped skill directly to the ungrouped bucket", () => {
  assert.match(actorSheet, /find\('\.remove-skill-from-group'\)/);
  assert.match(actorSheet, /targetGroupId: UNGROUPED_ORGANIZER_ID/);
});
