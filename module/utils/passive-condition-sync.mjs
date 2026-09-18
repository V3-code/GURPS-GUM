export function getPassiveConditionSourceUuid(item) {
  return item?._stats?.compendiumSource
    || item?._source?._stats?.compendiumSource
    || null;
}

export function preparePassiveConditionCreateData(sourceRule) {
  const data = sourceRule.toObject();
  delete data._id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  if (data.flags && Object.hasOwn(data.flags, "exportSource")) {
    delete data.flags.exportSource;
    if (Object.keys(data.flags).length === 0) delete data.flags;
  }
  data._stats = {
    ...(data._stats || {}),
    compendiumSource: sourceRule.uuid
  };
  return data;
}

export function buildPassiveConditionSyncOperations(actorItems, sourceRules) {
  const existingBySource = new Map();
  for (const item of actorItems ?? []) {
    const sourceUuid = getPassiveConditionSourceUuid(item);
    if (sourceUuid && !existingBySource.has(sourceUuid)) existingBySource.set(sourceUuid, item);
  }

  const updates = [];
  const creates = [];
  for (const sourceRule of sourceRules ?? []) {
    if (sourceRule.system?.bindingMode === "status-link") continue;
    const existing = existingBySource.get(sourceRule.uuid);
    if (!existing) {
      creates.push(preparePassiveConditionCreateData(sourceRule));
      continue;
    }

    const sourceData = sourceRule.toObject();
    updates.push({
      _id: existing.id,
      name: sourceData.name,
      system: sourceData.system,
      img: sourceData.img
    });
  }

  return { updates, creates };
}
