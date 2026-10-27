import { resolveEquipment } from "./equipment-resolution.mjs";
import { normalizeRequestedAttributeKey } from "./requested-attributes.mjs";

const text = value => String(value ?? "").trim().toLocaleLowerCase();

export function collectActiveEquipmentOwnerModifiers(items = []) {
  return Array.from(items || []).flatMap(item => {
    if (item?.type !== "equipment") return [];
    const system = item._source?.system || item.system || {};
    const equipped = system.equipped === true || text(system.location) === "equipped";
    if (!equipped) return [];
    const resolution = item.system?.equipmentResolution || resolveEquipment(system);
    return (resolution.ownerModifiers || []).map(record => ({
      ...record,
      sourceItemId: item.id,
      sourceItemName: String(item.name || "")
    }));
  });
}

export function equipmentSkillBonus(records = [], skill = {}) {
  const name = text(skill.name);
  const specialization = text(skill.system?.specialization);
  const displayName = specialization ? `${name} (${specialization})` : name;
  return records.filter(record => {
    if (record.kind !== "skill") return false;
    const needle = text(record.nameValue);
    if (!needle) return true;
    return record.nameCompare === "contains" ? displayName.includes(needle) : name === needle || displayName === needle;
  }).reduce((total, record) => total + (Number(record.value) || 0), 0);
}

export function equipmentAttributeBonus(records = [], attribute = "") {
  const target = normalizeRequestedAttributeKey(attribute);
  if (!target) return 0;
  return records
    .filter(record => record.kind === "attribute" && normalizeRequestedAttributeKey(record.nameValue) === target)
    .reduce((total, record) => total + (Number(record.value) || 0), 0);
}
