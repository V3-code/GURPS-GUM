import { normalizeRollTags, shouldIncludeInPermanentNh } from "./roll-purposes.mjs";

function signed(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function effectEntries(effect) {
  const data = effect?.rollModifier;
  if (!data) return [];
  const entries = Array.isArray(data.entries) && data.entries.length
    ? data.entries
    : [{
        value: data.value,
        nh_display_mode: data.nh_display_mode ?? "roll_only",
        target_values: data.target_values ?? "",
        source_item_ids: data.source_item_ids ?? "",
        contexts: data.contexts ?? data.context ?? "all",
        roll_tags: data.roll_tags ?? "",
        application_side: data.applicationSide ?? "self"
      }];
  return entries.map((entry) => ({ entry, data }));
}

function entryLabel(effect, entry) {
  const label = String(entry?.label ?? "").trim();
  const effectName = String(effect?.name ?? "Efeito").trim();
  return label && label !== effectName ? `${effectName} — ${label}` : effectName;
}

export function buildSkillModifierIndicators({
  effects = [],
  skill,
  passive = 0,
  temporary = 0,
  matchesTarget = () => true,
  matchesContext = () => true
} = {}) {
  const included = [];
  const rollOnly = [];

  for (const effect of effects) {
    for (const { entry, data } of effectEntries(effect)) {
      if (!matchesTarget(entry, skill) || !matchesContext(entry, skill)) continue;
      const side = entry?.application_side ?? entry?.applicationSide ?? data?.applicationSide ?? "self";
      if (String(side).trim() !== "self") continue;

      const value = Number(entry?.value);
      if (!Number.isFinite(value)) continue;
      const detail = { label: entryLabel(effect, entry), value };
      // Conditional entries depend on a purpose selected only when the roll
      // prompt opens. Showing them on every compatible skill creates noise and
      // implies an applicability that cannot be known from the sheet.
      if (normalizeRollTags(entry?.roll_tags ?? entry?.rollTags).length) continue;
      if (shouldIncludeInPermanentNh(entry)) included.push(detail);
      else rollOnly.push(detail);
    }
  }

  const passiveValue = Number(passive) || 0;
  const temporaryValue = Number(temporary) || 0;
  const includedTotal = passiveValue + temporaryValue + included.reduce((sum, item) => sum + item.value, 0);
  const rollTotal = rollOnly.reduce((sum, item) => sum + item.value, 0);
  const includedDetails = [
    ...(passiveValue ? [{ label: "Modificador passivo", value: passiveValue }] : []),
    ...(temporaryValue ? [{ label: "Modificador temporário", value: temporaryValue }] : []),
    ...included
  ];

  return {
    included: {
      visible: includedDetails.length > 0,
      total: includedTotal,
      title: ["NH modificado (valor já incorporado):", ...includedDetails.map((item) => `${item.label}: ${signed(item.value)}`), `Total incorporado: ${signed(includedTotal)}`].join("\n")
    },
    roll: {
      visible: rollOnly.length > 0,
      total: rollTotal,
      className: rollTotal >= 0 ? "is-positive" : "is-negative",
      title: ["Modificador aplicado somente na rolagem:", ...rollOnly.map((item) => `${item.label}: ${signed(item.value)}`), `Total na rolagem: ${signed(rollTotal)}`].join("\n")
    }
  };
}