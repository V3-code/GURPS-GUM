import { ROLL_PURPOSES, normalizePurposeIds } from "./roll-purposes.mjs";
import { matchesRollTags, normalizeRollTags } from "./roll-tags.mjs";

/**
 * Visibility matching deliberately treats an `all` entry as a list of useful
 * components. Mechanical matching remains the responsibility of
 * matchesRollTags with the entry's original match mode.
 */
export function isPurposeRelatedToEntry(purpose, entry = {}) {
  const required = normalizeRollTags(entry.roll_tags ?? entry.rollTags);
  if (!purpose || !required.length) return false;
  return matchesRollTags({ roll_tags: required, roll_tag_match: "any" }, purpose.tags || []);
}

export function getRelatedPurposeIds(entries = [], catalog = ROLL_PURPOSES) {
  return normalizePurposeIds(catalog
    .filter(purpose => purpose.id !== "general" && entries.some(entry => isPurposeRelatedToEntry(purpose, entry)))
    .map(purpose => purpose.id));
}

export function getContextualPurposeIds({ relatedPurposeIds = [], requestedPurposeIds = [], selectedPurposeIds = [] } = {}) {
  return normalizePurposeIds([...relatedPurposeIds, ...requestedPurposeIds, ...selectedPurposeIds]);
}

export function getInitialContextualFilterState(contextualPurposeIds = []) {
  return normalizePurposeIds(contextualPurposeIds).length > 0;
}