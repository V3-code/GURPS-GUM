const BASE_DAMAGE_ALIASES = Object.freeze([
  [/(?:gdpa|gdpg|thrustalt|thrust_alt|thrusta)/gi, "thrustAlt"],
  [/(?:geba|gebg|swingalt|swing_alt|swinga)/gi, "swingAlt"],
  [/(?:gdp|thrust|thr)/gi, "thrust"],
  [/(?:geb|gdb|swing|sw)/gi, "swing"]
]);

function addIntegerModifiers(formula) {
  const compact = String(formula || "").replace(/\s+/g, "");
  const match = compact.match(/^\(?(\d+)d6([+\-]\d+)?\)?((?:[+\-]\d+)*)$/i);
  if (!match) return formula;

  const modifierParts = [match[2], ...(match[3]?.match(/[+\-]\d+/g) || [])].filter(Boolean);
  const modifier = modifierParts.reduce((total, value) => total + Number.parseInt(value, 10), 0);
  return `${match[1]}d6${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ""}`;
}

/** Resolve GdP/GeB aliases into the dice expression shown on an actor's combat tab. */
export function resolveAttackDamageDisplay(formula, attributes = {}) {
  const thrust = String(attributes.thrust_damage || "0").trim();
  const swing = String(attributes.swing_damage || "0").trim();
  const values = {
    thrust,
    swing,
    thrustAlt: String(attributes.thrust_damage_alt || thrust).trim(),
    swingAlt: String(attributes.swing_damage_alt || swing).trim()
  };

  let resolved = String(formula || "").trim();
  for (const [alias, key] of BASE_DAMAGE_ALIASES) {
    resolved = resolved.replace(new RegExp(`\\b${alias.source}\\b`, alias.flags), `(${values[key]})`);
  }

  return addIntegerModifiers(resolved);
}