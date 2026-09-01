export const DAMAGE_NATURES = Object.freeze([
  { id: "fire", label: "Fogo", labelEn: "Fire", aliases: ["FOG", "FIR"] },
  { id: "cold", label: "Frio / Gelo", labelEn: "Cold / Ice", aliases: ["FRI", "GEL", "CLD", "ICE"] },
  { id: "electricity", label: "Eletricidade", labelEn: "Electricity", aliases: ["ELE", "ELC"] },
  { id: "acid", label: "Ácido", labelEn: "Acid", aliases: ["ACI", "ACD"] },
  { id: "poison", label: "Veneno", labelEn: "Poison", aliases: ["VEN", "PSN"] },
  { id: "psychic", label: "Psíquico", labelEn: "Psychic", aliases: ["PSI", "PSY"] },
  { id: "necrotic", label: "Necrótico", labelEn: "Necrotic", aliases: ["NEC"] },
  { id: "radiant", label: "Radiante", labelEn: "Radiant", aliases: ["RDN"] },
  { id: "sonic", label: "Sônico", labelEn: "Sonic / Thunder", aliases: ["SON", "SNC", "THN"] },
  { id: "magical-force", label: "Força Mágica", labelEn: "Magical Force", aliases: ["FOR"] },
  { id: "cosmic", label: "Cósmico", labelEn: "Cosmic", aliases: ["COS"] },
  { id: "radiation", label: "Radiação", labelEn: "Radiation", aliases: ["RAD"] },
  { id: "water", label: "Água", labelEn: "Water", aliases: ["AGU", "WTR"] },
  { id: "air", label: "Ar", labelEn: "Air", aliases: ["AER", "AIR"] },
  { id: "earth", label: "Terra", labelEn: "Earth", aliases: ["TER", "EAR"] },
  { id: "direct-trauma", label: "Trauma Direto", labelEn: "Direct Trauma", aliases: ["TDR", "DTR"] }
]);

const fold = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const index = new Map();
for (const nature of DAMAGE_NATURES) {
  for (const value of [nature.id, nature.label, nature.labelEn, ...nature.aliases]) index.set(fold(value), nature);
}

/** Resolve a localized name or three-letter alias without affecting damage mechanics. */
export function resolveDamageNature(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const known = index.get(fold(raw));
  if (known) return { id: known.id, label: known.label, abbreviation: known.aliases[0], custom: false };
  const custom = raw.match(/^(.+?)(?:\s*\[([A-Za-z]{3})\])?$/);
  if (!custom) return null;
  const label = custom[1].trim();
  const abbreviation = (custom[2] || suggestDamageNatureAbbreviation(label)).toUpperCase();
  const knownAlias = index.get(fold(abbreviation));
  if (knownAlias && [knownAlias.label, knownAlias.labelEn].some(name => fold(name) === fold(label))) {
    return { id: knownAlias.id, label: knownAlias.label, abbreviation: knownAlias.aliases[0], custom: false };
  }
  if (!label || abbreviation.length !== 3 || knownAlias) return null;
  return { id: `custom:${fold(label).replace(/[^a-z0-9]+/g, "-")}`, label, abbreviation, custom: true };
}

export function suggestDamageNatureAbbreviation(label) {
  const letters = fold(label).replace(/[^a-z]/g, "");
  const consonants = letters.replace(/[aeiou]/g, "");
  return `${consonants}${letters}`.slice(0, 3).toUpperCase();
}

export function formatDamageNature(value) {
  const nature = typeof value === "object" && value?.id ? value : resolveDamageNature(value);
  return nature ? `${nature.label} [${nature.abbreviation}]` : "";
}