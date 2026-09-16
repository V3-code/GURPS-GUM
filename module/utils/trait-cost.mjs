/** Canonical trait pricing. No Foundry dependency and no legacy calculation mode. */
const costDisplay = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 10, useGrouping: false });
function number(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Número de custo inválido: ${value}`);
  return result;
}

export function parseTraitAdjustment(raw = '0%') {
  const text = String(raw).trim().replace(',', '.').replace('×', 'x');
  const match = text.match(/^(x)?\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))(%)?$/i);
  if (!match) throw new Error(`Modificador de custo inválido: ${text}`);
  const value = Number(match[2]);
  if (match[1] && value < 0) throw new Error(`Multiplicador inválido: ${text}`);
  return { operation: match[1] ? 'multiply' : match[3] ? 'percent' : 'points',
    value: match[1] && match[3] ? value / 100 : value };
}

function leaves(modifiers, result = []) {
  for (const mod of Object.values(modifiers || {})) {
    if (mod.disabled) continue;
    if (Array.isArray(mod.children)) leaves(mod.children, result);
    else result.push(mod);
  }
  return result;
}

export function calculateTraitCost(system = {}) {
  let base = number(system.points);
  let perLevel = system.can_level ? number(system.points_per_level) : 0;
  const level = system.can_level ? number(system.level) : 0;
  if (level < 0) throw new Error('Nível de custo inválido');
  let multiplier = number(system.cost_multiplier, 1);
  const scopes = { base: { enhancement: 0, limitation: 0 }, levels: { enhancement: 0, limitation: 0 } };
  const breakdown = [];
  for (const mod of leaves(system.modifiers)) {
    const parsed = parseTraitAdjustment(mod.cost);
    const affects = mod.affects || 'total';
    if (!['total', 'base_only', 'levels_only'].includes(affects)) throw new Error(`escopo de custo inválido: ${affects}`);
    const ownLevel = mod.use_level_from_trait ? (system.can_level ? level : 0) : number(mod.level);
    const scale = mod.cost_ignores_level || ownLevel <= 0 ? 1 : Math.max(1, ownLevel);
    const value = parsed.value * scale;
    breakdown.push({ name: mod.name || '', operation: parsed.operation, value, affects });
    if (parsed.operation === 'points') {
      if (affects === 'levels_only') { if (system.can_level) perLevel += value; }
      else base += value;
    } else if (parsed.operation === 'multiply') multiplier *= value;
    else {
      const key = value < 0 ? 'limitation' : 'enhancement';
      if (affects !== 'levels_only') scopes.base[key] += value;
      if (affects !== 'base_only') scopes.levels[key] += value;
    }
  }
  const factor = ({ enhancement, limitation }) => system.multiplicative_modifiers
    ? (1 + enhancement / 100) * (1 + Math.max(-80, limitation) / 100)
    : 1 + Math.max(-80, enhancement + limitation) / 100;
  const baseFactor = factor(scopes.base), levelFactor = factor(scopes.levels);
  const raw = (base * baseFactor + perLevel * level * levelFactor) * multiplier;
  if (!Number.isFinite(raw)) throw new Error('Resultado de custo inválido');
  // Remove only floating-point noise at integer boundaries, not actual fractions.
  const nearest = Math.round(raw);
  const roundedInput = Math.abs(raw - nearest) <= Number.EPSILON * Math.max(1, Math.abs(raw)) * 8 ? nearest : raw;
  const finalPoints = system.round_down ? Math.floor(roundedInput) : Math.ceil(roundedInput);
  return { finalPoints, raw, breakdown,
    description: `Base ${costDisplay.format(base)} × ${costDisplay.format(baseFactor)}; níveis ${costDisplay.format(perLevel)} × ${costDisplay.format(level)} × ${costDisplay.format(levelFactor)}; multiplicador ×${costDisplay.format(multiplier)}` };
}

export function calculateItemTraitCost(item) {
  const system = item?.system || {};
  return calculateTraitCost(item?.type === 'power' && system.cost_paid === 'alternative'
    ? { ...system, points: system.alternative_points } : system);
}

export function traitCostInput(system) {
  return Object.fromEntries(['points', 'points_per_level', 'level', 'can_level', 'round_down',
    'cost_multiplier', 'multiplicative_modifiers', 'modifiers'].map(key => [key, system[key]]));
}

export function importGCSModifier(mod) {
  const cost = mod.cost_adj ?? '0%';
  parseTraitAdjustment(cost);
  return { name: mod.name || 'Modificador', cost, level: number(mod.levels),
    affects: mod.affects || 'total', use_level_from_trait: Boolean(mod.use_level_from_trait),
    cost_ignores_level: Boolean(mod.cost_ignores_level), disabled: Boolean(mod.disabled),
    ref: mod.reference || '', description: mod.local_notes || mod.notes || '' };
}

export function importGCSTraitCost(trait, inherited = []) {
  const cr = { 0: 1, 6: 2, 7: 1.83, 8: 1.67, 9: 1.5, 10: 1.33, 11: 1.17, 12: 1, 13: .83, 14: .67, 15: .5 };
  if (!(number(trait.cr) in cr)) throw new Error(`Autocontrole não suportado: ${trait.cr}`);
  if (trait.frequency) throw new Error(`Frequência de custo não suportada: ${trait.frequency}`);
  const modifiers = Object.fromEntries(leaves([...inherited, ...(trait.modifiers || [])])
    .map((mod, index) => [`gcs${index}`, importGCSModifier(mod)]));
  return { points: number(trait.base_points), points_per_level: number(trait.points_per_level),
    can_level: Boolean(trait.can_level), level: number(trait.levels),
    round_down: Boolean(trait.round_down), multiplicative_modifiers: Boolean(trait._multiplicativeModifiers), cost_multiplier: cr[number(trait.cr)],
    modifiers };
}
