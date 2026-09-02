export const DAMAGE_NATURES = Object.freeze([
  { id: "fire", label: "Fogo", labelEn: "Fire", aliases: ["FGO", "FRE", "FOG", "FIR"] },
  { id: "cold", label: "Frio / Gelo", labelEn: "Cold / Ice", aliases: ["FRI", "GEL", "GELO", "CLD", "ICE"] },
  { id: "electricity", label: "Eletricidade", labelEn: "Electricity", aliases: ["ELE", "ELC", "ELET", "ELEC"] },
  { id: "acid", label: "Ácido", labelEn: "Acid", aliases: ["ACI", "ACD", "ACID"] },
  { id: "poison", label: "Veneno", labelEn: "Poison", aliases: ["VEN", "PSN", "POIS"] },
  { id: "psychic", label: "Psíquico", labelEn: "Psychic", aliases: ["PSI", "PSY", "PSIQ"] },
  { id: "necrotic", label: "Necrótico", labelEn: "Necrotic", aliases: ["NEC", "NECR"] },
  { id: "radiant", label: "Radiante", labelEn: "Radiant", aliases: ["RDN", "RADI"] },
  { id: "sonic", label: "Sônico", labelEn: "Sonic / Thunder", aliases: ["SON", "SNC", "SONI", "THN"] },
  { id: "magical-force", label: "Força Mágica", labelEn: "Magical Force", aliases: ["FORCE", "FORC", "FRC", "FOR"] },
  { id: "cosmic", label: "Cósmico", labelEn: "Cosmic", aliases: ["COS", "COSM"] },
  { id: "radiation", label: "Radiação", labelEn: "Radiation", aliases: ["RAD", "RADC"] },
  { id: "water", label: "Água", labelEn: "Water", aliases: ["AGU", "AGUA", "WTR"] },
  { id: "air", label: "Ar", labelEn: "Air", aliases: ["AER", "AIR"] },
  { id: "earth", label: "Terra", labelEn: "Earth", aliases: ["TER", "TERRA", "EAR"] },
  { id: "direct-trauma", label: "Trauma Direto", labelEn: "Direct Trauma", aliases: ["TDR", "TRD", "DTR"] }
]);

const fold = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const index = new Map();
for (const nature of DAMAGE_NATURES) {
  for (const value of [nature.id, nature.label, nature.labelEn, ...nature.aliases]) {
    const key = fold(value);
    const existing = index.get(key);
    if (existing && existing.id !== nature.id) throw new Error(`Alias de natureza de dano duplicado: ${value}`);
    index.set(key, nature);
  }
}

/** Resolve a localized name or alias without affecting damage mechanics. */
export function resolveDamageNature(value) {
  if (typeof value === "object" && value?.id) {
    const knownObject = index.get(fold(value.id));
    if (knownObject) return { id: knownObject.id, label: knownObject.label, abbreviation: knownObject.aliases[0], custom: false };
    if (value.custom && value.label) return value;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const known = index.get(fold(raw));
  if (known) return { id: known.id, label: known.label, abbreviation: known.aliases[0], custom: false };
  const decorated = raw.match(/^(.+?)\s*(?:\[([^\]]+)\]|\(([^)]+)\))$/);
  if (decorated) {
    const knownLabel = index.get(fold(decorated[1]));
    if (knownLabel) return { id: knownLabel.id, label: knownLabel.label, abbreviation: knownLabel.aliases[0], custom: false };
  }
  const custom = raw.match(/^(.+?)(?:\s*(?:\[([A-Za-z][A-Za-z0-9-]{1,11})\]|\(([A-Za-z][A-Za-z0-9-]{1,11})\)))?$/);
  if (!custom) return null;
  const label = custom[1].trim();
  const abbreviation = (custom[2] || custom[3] || suggestDamageNatureAbbreviation(label)).toUpperCase();
  const knownAlias = index.get(fold(abbreviation));
  if (knownAlias && [knownAlias.label, knownAlias.labelEn].some(name => fold(name) === fold(label))) {
    return { id: knownAlias.id, label: knownAlias.label, abbreviation: knownAlias.aliases[0], custom: false };
  }
  if (!label || knownAlias) return null;
  return { id: `custom:${fold(label).replace(/[^a-z0-9]+/g, "-")}`, label, abbreviation, custom: true };
}

export function suggestDamageNatureAbbreviation(label) {
  const letters = fold(label).replace(/[^a-z]/g, "");
  const consonants = letters.replace(/[aeiou]/g, "");
  return `${consonants}${letters}`.slice(0, 3).toUpperCase();
}

export function formatDamageNature(value) {
  const nature = typeof value === "object" && value?.id ? value : resolveDamageNature(value);
  return nature?.label || "";
}

/** Build datalist entries that expose every searchable term alongside its canonical nature name. */
export function buildDamageNatureSearchOptions() {
  return DAMAGE_NATURES.flatMap(nature => [
    { value: nature.label, label: nature.label },
    { value: nature.labelEn, label: nature.label },
    ...nature.aliases.map(alias => ({ value: alias, label: nature.label }))
  ]);
}