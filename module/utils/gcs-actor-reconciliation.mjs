function importedGCSId(item) {
  const value = item?.flags?.gum?.hybridImport?.gcsId;
  return value === null || value === undefined || value === "" ? null : String(value);
}

function isGCSImported(item) {
  return Boolean(item?.flags?.gum?.hybridImport);
}

function legacyKey(item) {
  const specialization = item?.system?.specialization || "";
  return `${item?.type || ""}::${String(item?.name || "").trim().toLocaleLowerCase()}::${String(specialization).trim().toLocaleLowerCase()}`;
}

function comparableItem(item) {
  const clone = structuredClone(item?.toObject ? item.toObject() : item || {});
  delete clone._id;
  delete clone.sort;
  delete clone.folder;
  delete clone.ownership;
  delete clone._stats;
  if (clone.flags?.gum?.hybridImport) delete clone.flags.gum.hybridImport.importedAt;
  return clone;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildGCSActorReconciliation(existingItems = [], incomingItems = []) {
  const unmatchedExisting = new Set(existingItems.filter(isGCSImported));
  const byGCSId = new Map();
  const byLegacyKey = new Map();

  for (const item of unmatchedExisting) {
    const gcsId = importedGCSId(item);
    if (gcsId && !byGCSId.has(`${item.type}::${gcsId}`)) byGCSId.set(`${item.type}::${gcsId}`, item);
    const key = legacyKey(item);
    if (!byLegacyKey.has(key)) byLegacyKey.set(key, item);
  }

  const additions = [];
  const updates = [];
  const unchanged = [];

  for (const incoming of incomingItems) {
    const gcsId = importedGCSId(incoming);
    let existing = gcsId ? byGCSId.get(`${incoming.type}::${gcsId}`) : null;
    if (!existing) existing = byLegacyKey.get(legacyKey(incoming));

    if (!existing || !unmatchedExisting.has(existing)) {
      additions.push(incoming);
      continue;
    }

    unmatchedExisting.delete(existing);
    const entry = { existing, incoming };
    if (stableStringify(comparableItem(existing)) === stableStringify(comparableItem(incoming))) unchanged.push(entry);
    else updates.push(entry);
  }

  return {
    additions,
    updates,
    removals: [...unmatchedExisting],
    unchanged
  };
}