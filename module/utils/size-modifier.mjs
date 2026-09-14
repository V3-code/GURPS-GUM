export const AUTO_SIZE_MODIFIER_MODES = Object.freeze({
  OFF: "off",
  TARGET: "target",
  RELATIVE: "relative"
});

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function signed(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

/** Calculate the attack modifier produced by the target's Size Modifier. */
export function calculateAttackSizeModifier(sourceMT, targetMT, mode = AUTO_SIZE_MODIFIER_MODES.OFF) {
  if (![AUTO_SIZE_MODIFIER_MODES.TARGET, AUTO_SIZE_MODIFIER_MODES.RELATIVE].includes(mode)) return null;

  const target = finiteNumber(targetMT);
  if (target === null) return null;

  if (mode === AUTO_SIZE_MODIFIER_MODES.TARGET) {
    return {
      mode,
      sourceMT: finiteNumber(sourceMT),
      targetMT: target,
      modifier: target,
      label: `MT do alvo (${signed(target)})`
    };
  }

  const source = finiteNumber(sourceMT);
  if (source === null) return null;
  const modifier = target - source;
  return {
    mode,
    sourceMT: source,
    targetMT: target,
    modifier,
    label: `MT relativo [${signed(target)} − (${signed(source)})]`
  };
}