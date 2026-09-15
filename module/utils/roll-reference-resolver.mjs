import { normalizeSkillText } from "./skill-default-resolver.mjs";
import { getSkillDisplayName } from "./skill-display-name.mjs";

const ATTRIBUTE_ALIASES = new Map([
  ["st", "st"], ["dx", "dx"], ["iq", "iq"], ["ht", "ht"], ["per", "per"],
  ["percepcao", "per"], ["vont", "vont"], ["vontade", "vont"], ["will", "vont"]
]);

function splitTopLevel(source) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const character of String(source ?? "")) {
    if (character === "(") depth += 1;
    if (character === ")" && depth > 0) depth -= 1;
    if (character === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseModifier(referenceText) {
  const raw = String(referenceText ?? "").trim();
  const match = raw.match(/^(.*?)([+-]\d+)\s*$/);
  if (!match?.[1]?.trim()) return { reference: raw, modifier: 0 };
  return { reference: match[1].trim(), modifier: Number(match[2]) };
}

function parseSkillReference(reference) {
  const match = String(reference ?? "").trim().match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!match) return { name: String(reference ?? "").trim(), specialization: "" };
  return { name: match[1].trim(), specialization: match[2].trim() };
}

function attributeValue(attributes, key) {
  const data = attributes?.[key];
  const value = Number(data?.final ?? data?.final_computed ?? data?.value);
  return Number.isFinite(value) ? value : null;
}

function resolveSingleReference(rawReference, attributes, skills) {
  const { reference, modifier } = parseModifier(rawReference);
  const normalized = normalizeSkillText(reference);
  const fixedNumber = Number(reference);
  if (reference && Number.isFinite(fixedNumber)) {
    return { available: true, value: fixedNumber + modifier, label: reference, sourceType: "fixed" };
  }

  const attributeKey = ATTRIBUTE_ALIASES.get(normalized);
  const baseAttribute = attributeKey ? attributeValue(attributes, attributeKey) : null;
  if (baseAttribute !== null) {
    return { available: true, value: baseAttribute + modifier, label: `${reference}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`, sourceType: "attribute" };
  }

  const wanted = parseSkillReference(reference);
  const normalizedName = normalizeSkillText(wanted.name);
  const normalizedSpecialization = normalizeSkillText(wanted.specialization);
  const skill = Array.from(skills ?? []).find(item => item?.type === "skill"
    && normalizeSkillText(item.name) === normalizedName
    && (!normalizedSpecialization || normalizeSkillText(item.system?.specialization) === normalizedSpecialization));
  const skillValue = Number(skill?.system?.final_nh);
  if (!skill || !Number.isFinite(skillValue)) return null;

  const displayName = getSkillDisplayName(skill);
  return {
    available: true,
    value: skillValue + modifier,
    label: `${displayName}${modifier ? (modifier > 0 ? `+${modifier}` : modifier) : ""}`,
    sourceType: "skill",
    itemId: skill.id ?? null,
    itemUuid: skill.uuid ?? null
  };
}

export function resolveRollReference(rawReference, attributes = {}, skills = []) {
  const source = String(rawReference ?? "").trim() || "DX";
  const expression = source.match(/^(maior|menor|max|min)\s*\((.*)\)$/i);
  const references = splitTopLevel(expression ? expression[2] : source);
  const mode = expression && /^(menor|min)$/i.test(expression[1]) ? "min" : references.length > 1 ? "max" : "single";
  const candidates = references.map(reference => resolveSingleReference(reference, attributes, skills)).filter(Boolean);
  if (!candidates.length) return { available: false, value: null, label: "N/A", sourceType: "unavailable" };
  if (mode === "min") return candidates.reduce((best, current) => current.value < best.value ? current : best);
  if (mode === "max") return candidates.reduce((best, current) => current.value > best.value ? current : best);
  return candidates[0];
}