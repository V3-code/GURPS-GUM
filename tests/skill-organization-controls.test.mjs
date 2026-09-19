import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");

test("group deletion uses a promise-backed confirmation compatible with the legacy sheet", () => {
  assert.match(actorSheet, /_confirmSkillOrganizationAction\([\s\S]*new Promise\(resolve/);
  assert.match(actorSheet, /_deleteSkillOrganizationGroup[\s\S]*await this\._confirmSkillOrganizationAction/);
  assert.doesNotMatch(actorSheet, /_deleteSkillOrganizationGroup[\s\S]{0,500}Dialog\.confirm/);
  assert.match(actorSheet, /payload\[`-=\$\{key\}`\] = null/);
  assert.match(actorSheet, /skill_organization\.groups": withDeletions/);
  assert.match(actorSheet, /skill_organization\.assignments": withDeletions/);
});

test("category suggestions show a selectable preview before changing organization", () => {
  assert.match(actorSheet, /buildItemCategoryGroupPlan\(organization, skills\)/);
  assert.match(actorSheet, /_promptSkillCategoryGroupPlan\(plan\)/);
  assert.match(actorSheet, /input type="checkbox" name="category"/);
  assert.match(actorSheet, /createGroupsFromItemCategories\(organization, skills, createId, selectedCategories\)/);
});

test("the remove action moves a grouped skill directly to the ungrouped bucket", () => {
  assert.match(actorSheet, /skill\.skillOrganizationCanRemove = bucketId !== UNGROUPED_ORGANIZER_ID/);
  assert.match(actorSheet, /find\('\.remove-skill-from-group'\)/);
  assert.match(actorSheet, /targetGroupId: UNGROUPED_ORGANIZER_ID/);
});

test("skill section summaries explicitly toggle their details state", () => {
  assert.match(actorSheet, /find\('\.skill-tree-summary'\)\.click/);
  assert.match(actorSheet, /details\.open = !details\.open/);
});

test("skill search normalizes text, filters cards and restores collapsed state", () => {
  assert.match(actorSheet, /find\('\.skill-search-input'\)\.on\('input'/);
  assert.match(actorSheet, /normalize\('NFD'\)/);
  assert.match(actorSheet, /card\.hidden = !matches/);
  assert.match(actorSheet, /skillSearchWasOpen/);
  assert.match(actorSheet, /skills-search-empty/);
});

test("category preview dialog uses its dedicated polished presentation", () => {
  assert.match(actorSheet, /skill-category-preview__intro/);
  assert.match(actorSheet, /classes: \["dialog", "gum", "gum-sheet-edit-dialog", "skill-category-preview-dialog"\], width: 520/);
});

test("skill organization dialogs opt into the established minimal sheet dialog classes", () => {
  assert.match(actorSheet, /gum-popup-form gum-record-editor skill-group-name-dialog/);
  assert.match(actorSheet, /gum-record-editor__intro form-group--full/);
  assert.match(actorSheet, /classes: \["dialog", "gum", "gum-sheet-edit-dialog", "gum-record-edit-dialog", "skill-group-dialog"\]/);
  assert.match(actorSheet, /classes: \["dialog", "gum", "gum-sheet-edit-dialog", "skill-organization-confirm-dialog"\]/);
});
