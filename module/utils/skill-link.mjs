import { getSkillDisplayName } from "./skill-display-name.mjs";

const LINK_TARGET_PATHS = Object.freeze({
  "system.base_attribute_custom": "system.base_attribute",
  "system.tree_base_attribute_custom": "system.tree_base_attribute"
});

export function canonicalSkillLinkTargetPath(path) {
  const normalized = String(path ?? "").trim();
  return LINK_TARGET_PATHS[normalized] || normalized;
}

export function normalizeSkillLinkSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function collectSkillLinkCandidates(items, { allowedHierarchyTypes = [], currentValue = "" } = {}) {
  const allowed = new Set(Array.from(allowedHierarchyTypes || []).map(value => String(value ?? "").trim()).filter(Boolean));
  const selectedName = normalizeSkillLinkSearch(currentValue);

  return Array.from(items || [])
    .filter(item => item?.type === "skill")
    .filter(item => !allowed.size || allowed.has(String(item.system?.tree_hierarchy_type ?? item.system?.hierarchy_type ?? "")))
    .map(item => {
      const displayName = getSkillDisplayName(item);
      const system = item.system || {};
      const group = String(system.group || "").trim();
      const baseAttribute = String(system.base_attribute || "").trim();
      const difficulty = String(system.difficulty || "").trim();
      const finalNh = system.final_nh ?? "";
      return {
        id: String(item.id || ""),
        displayName,
        image: String(item.img || "icons/svg/book.svg"),
        group,
        baseAttribute,
        difficulty,
        finalNh,
        selected: Boolean(selectedName) && normalizeSkillLinkSearch(displayName) === selectedName,
        searchText: normalizeSkillLinkSearch([
          displayName,
          item.name,
          system.specialization,
          group,
          baseAttribute,
          difficulty
        ].join(" "))
      };
    })
    .filter(candidate => candidate.id && candidate.displayName)
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR", { sensitivity: "base" }));
}
