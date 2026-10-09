export function templateEntryDisplayName(entry, sourceItem = null) {
  const name = String(entry?.name || entry?.label || sourceItem?.name || "").trim();
  const specialization = String(entry?.specialization || entry?.inlineItem?.system?.specialization || sourceItem?.system?.specialization || "").trim();
  if (!name || !specialization) return name;
  return name.toLocaleLowerCase().endsWith(` (${specialization})`.toLocaleLowerCase())
    ? name
    : `${name} (${specialization})`;
}
