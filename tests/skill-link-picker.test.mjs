import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  canonicalSkillLinkTargetPath,
  collectSkillLinkCandidates,
  normalizeSkillLinkSearch
} from "../module/utils/skill-link.mjs";

const itemSheet = fs.readFileSync(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8");
const template = fs.readFileSync(new URL("../templates/items/item-sheet.hbs", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles/item-sheet.css", import.meta.url), "utf8");
const ptBr = JSON.parse(fs.readFileSync(new URL("../lang/pt-BR.json", import.meta.url), "utf8"));
const en = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));

const skill = (id, name, system = {}) => ({
  id,
  name,
  type: "skill",
  img: `icons/${id}.webp`,
  system
});

test("maps form-only skill link fields to their canonical persisted paths", () => {
  assert.equal(canonicalSkillLinkTargetPath("system.base_attribute_custom"), "system.base_attribute");
  assert.equal(canonicalSkillLinkTargetPath("system.tree_base_attribute_custom"), "system.tree_base_attribute");
  assert.equal(canonicalSkillLinkTargetPath("system.tree_parent"), "system.tree_parent");
  assert.equal(canonicalSkillLinkTargetPath("system.melee_attacks.slash.skill_name"), "system.melee_attacks.slash.skill_name");
});

test("builds searchable, sorted skill choices with specialization and current selection", () => {
  const candidates = collectSkillLinkCandidates([
    skill("axe", "Machado", { specialization: "Duas Mãos", group: "Combate", base_attribute: "dx", difficulty: "A", final_nh: 13 }),
    { id: "other", name: "Não é perícia", type: "equipment", system: {} },
    skill("archery", "Arco", { group: "Distância", base_attribute: "dx", difficulty: "D", final_nh: 12 })
  ], { currentValue: "Machado (Duas Mãos)" });

  assert.deepEqual(candidates.map(candidate => candidate.id), ["archery", "axe"]);
  assert.equal(candidates[1].displayName, "Machado (Duas Mãos)");
  assert.equal(candidates[1].selected, true);
  assert.equal(candidates[1].searchText.includes(normalizeSkillLinkSearch("duas mãos combate")), true);
});

test("applies hierarchy filters used by tree parent links", () => {
  const candidates = collectSkillLinkCandidates([
    skill("trunk", "Tronco", { tree_hierarchy_type: "trunk" }),
    skill("branch", "Galho", { tree_hierarchy_type: "branch" }),
    skill("leaf", "Folha", { tree_hierarchy_type: "leaf" })
  ], { allowedHierarchyTypes: ["trunk", "branch"] });
  assert.deepEqual(candidates.map(candidate => candidate.id), ["branch", "trunk"]);
});

test("item sheet uses the polished picker and writes the selected display name to the canonical path", () => {
  assert.match(itemSheet, /canonicalSkillLinkTargetPath\(rawPath\)/);
  assert.match(itemSheet, /this\.item\.update\(\{ \[path\]: selected\.displayName \}\)/);
  assert.match(itemSheet, /class="skill-link-picker"/);
  assert.match(itemSheet, /class="skill-link-option/);
  assert.match(itemSheet, /gum-skill-link-dialog/);
  assert.match(styles, /gum-skill-link-dialog \.skill-link-option\.is-selected/);
  assert.match(styles, /grid-template-columns: 14px 38px minmax\(0, 1fr\) auto/);
});

test("every existing skill-link context remains connected to the shared picker", () => {
  assert.equal((template.match(/class="link-skill-button/g) || []).length, 5);
  assert.match(template, /data-link-target="system\.base_attribute_custom"/);
  assert.match(template, /data-link-target="system\.tree_parent"/);
  assert.match(template, /data-link-target="system\.tree_base_attribute_custom"/);
  assert.match(template, /data-name="system\.melee_attacks\.\{\{key\}\}\.skill_name"/);
  assert.match(template, /data-name="system\.ranged_attacks\.\{\{key\}\}\.skill_name"/);
});

test("skill picker copy is localized in English and Portuguese", () => {
  for (const key of [
    "GUM.SkillLink.Title",
    "GUM.SkillLink.Hint",
    "GUM.SkillLink.SearchPlaceholder",
    "GUM.SkillLink.NoResults",
    "GUM.SkillLink.NoCompatibleSkills",
    "GUM.SkillLink.SelectRequired",
    "GUM.SkillLink.Link",
    "GUM.SkillLink.Cancel",
    "GUM.SkillLink.FinalLevel"
  ]) {
    assert.equal(typeof ptBr[key], "string", key);
    assert.equal(typeof en[key], "string", key);
  }
});
