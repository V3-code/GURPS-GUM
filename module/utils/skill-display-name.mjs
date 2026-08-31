/** Return the presentation name used for a skill without changing its document name. */
export function getSkillDisplayName(skill = {}) {
  const name = String(skill.name ?? "").trim();
  const specialization = String(skill.system?.specialization ?? skill.specialization ?? "").trim();
  return specialization ? `${name} (${specialization})` : name;
}

/**
 * Replace only the text portion of a directory label, preserving Foundry's icons
 * and other child elements.
 */
export function setDirectoryEntryLabel(element, label) {
  if (!element || !label) return;
  const textNode = Array.from(element.childNodes ?? []).find(node =>
    node.nodeType === 3 && node.textContent.trim()
  );
  if (textNode) textNode.textContent = ` ${label}`;
  else element.textContent = label;
  element.title = label;
}