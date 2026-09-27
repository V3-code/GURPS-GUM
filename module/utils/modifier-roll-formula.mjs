const DICE_TERM_PATTERN = /(?:^|[^A-Za-z0-9_])\d*d(?:\d+|%|f)\b/i;

export function evaluateModifierRollFormulaSync(formula, rollData = {}, RollClass = globalThis.Roll) {
    const source = String(formula ?? "").trim();
    if (!source || !DICE_TERM_PATTERN.test(source) || typeof RollClass !== "function") return null;

    try {
        const roll = new RollClass(source, rollData ?? {});
        const evaluated = typeof roll.evaluateSync === "function"
            ? roll.evaluateSync()
            : roll.evaluate({ async: false });
        if (evaluated && typeof evaluated.then === "function") return null;
        const total = Number((evaluated ?? roll).total);
        return Number.isFinite(total) ? total : null;
    } catch (_) {
        return null;
    }
}
