export const UNGROUPED_ORGANIZER_ID = "__ungrouped__";

const cleanId = value => String(value ?? "").trim();

export function normalizeItemOrganization(raw = {}, itemIds = []) {
  const validItems = [...new Set(itemIds.map(cleanId).filter(Boolean))];
  const validItemSet = new Set(validItems);
  const rawGroups = raw?.groups && typeof raw.groups === "object" ? raw.groups : {};
  const groups = {};

  for (const [rawId, entry] of Object.entries(rawGroups)) {
    const id = cleanId(rawId);
    const name = String(entry?.name ?? "").trim();
    if (!id || !name) continue;
    groups[id] = { name };
  }

  const requestedGroupOrder = Array.isArray(raw?.groupOrder) ? raw.groupOrder.map(cleanId) : [];
  const groupOrder = [...new Set([
    ...requestedGroupOrder.filter(id => groups[id]),
    ...Object.keys(groups)
  ])];

  const assignments = {};
  for (const [rawItemId, rawGroupId] of Object.entries(raw?.assignments ?? {})) {
    const itemId = cleanId(rawItemId);
    const groupId = cleanId(rawGroupId);
    if (validItemSet.has(itemId) && groups[groupId]) assignments[itemId] = groupId;
  }

  const rawItemOrder = raw?.itemOrder && typeof raw.itemOrder === "object" ? raw.itemOrder : {};
  const itemOrder = {};
  const bucketIds = [UNGROUPED_ORGANIZER_ID, ...groupOrder];
  for (const bucketId of bucketIds) {
    const belongsToBucket = itemId => bucketId === UNGROUPED_ORGANIZER_ID
      ? !assignments[itemId]
      : assignments[itemId] === bucketId;
    const requested = Array.isArray(rawItemOrder[bucketId]) ? rawItemOrder[bucketId].map(cleanId) : [];
    itemOrder[bucketId] = [...new Set([
      ...requested.filter(itemId => validItemSet.has(itemId) && belongsToBucket(itemId)),
      ...validItems.filter(itemId => belongsToBucket(itemId))
    ])];
  }

  return { groups, groupOrder, assignments, itemOrder };
}

export function addItemOrganizationGroup(raw, { id, name }, itemIds = []) {
  const organization = normalizeItemOrganization(raw, itemIds);
  const groupId = cleanId(id);
  const groupName = String(name ?? "").trim();
  if (!groupId || !groupName || organization.groups[groupId]) return organization;
  organization.groups[groupId] = { name: groupName };
  organization.groupOrder.push(groupId);
  organization.itemOrder[groupId] = [];
  return organization;
}

export function renameItemOrganizationGroup(raw, { id, name }, itemIds = []) {
  const organization = normalizeItemOrganization(raw, itemIds);
  const groupId = cleanId(id);
  const groupName = String(name ?? "").trim();
  if (organization.groups[groupId] && groupName) organization.groups[groupId].name = groupName;
  return organization;
}

export function removeItemOrganizationGroup(raw, groupId, itemIds = []) {
  const organization = normalizeItemOrganization(raw, itemIds);
  const id = cleanId(groupId);
  if (!organization.groups[id]) return organization;

  const releasedItems = organization.itemOrder[id] ?? [];
  for (const itemId of releasedItems) delete organization.assignments[itemId];
  organization.itemOrder[UNGROUPED_ORGANIZER_ID].push(...releasedItems);
  delete organization.itemOrder[id];
  delete organization.groups[id];
  organization.groupOrder = organization.groupOrder.filter(entry => entry !== id);
  return normalizeItemOrganization(organization, itemIds);
}

export function moveOrganizedItem(raw, { itemId, targetGroupId, targetIndex }, itemIds = []) {
  const organization = normalizeItemOrganization(raw, itemIds);
  const id = cleanId(itemId);
  const requestedGroupId = cleanId(targetGroupId);
  const bucketId = organization.groups[requestedGroupId] ? requestedGroupId : UNGROUPED_ORGANIZER_ID;
  if (!itemIds.map(cleanId).includes(id)) return organization;

  for (const order of Object.values(organization.itemOrder)) {
    const currentIndex = order.indexOf(id);
    if (currentIndex >= 0) order.splice(currentIndex, 1);
  }

  if (bucketId === UNGROUPED_ORGANIZER_ID) delete organization.assignments[id];
  else organization.assignments[id] = bucketId;

  const destination = organization.itemOrder[bucketId] ?? (organization.itemOrder[bucketId] = []);
  const index = Math.max(0, Math.min(Number.isInteger(targetIndex) ? targetIndex : destination.length, destination.length));
  destination.splice(index, 0, id);
  return organization;
}

export function createGroupsFromItemCategories(raw, items = [], createId) {
  const itemIds = items.map(item => cleanId(item?.id)).filter(Boolean);
  let organization = normalizeItemOrganization(raw, itemIds);
  const groupsByName = new Map(
    organization.groupOrder.map(id => [organization.groups[id].name.toLocaleLowerCase(), id])
  );

  for (const item of items) {
    if (organization.assignments[cleanId(item?.id)]) continue;
    const category = String(item?.system?.group ?? "").trim();
    if (!category || category.toLocaleLowerCase() === "geral") continue;
    const key = category.toLocaleLowerCase();
    let groupId = groupsByName.get(key);
    if (!groupId) {
      groupId = cleanId(createId());
      organization = addItemOrganizationGroup(organization, { id: groupId, name: category }, itemIds);
      groupsByName.set(key, groupId);
    }
    organization = moveOrganizedItem(organization, { itemId: item.id, targetGroupId: groupId }, itemIds);
  }
  return organization;
}
