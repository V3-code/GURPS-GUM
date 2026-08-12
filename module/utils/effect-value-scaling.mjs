export const EFFECT_VALUE_MODES = Object.freeze({
    FIXED: "fixed",
    PER_ORIGIN_LEVEL: "per_origin_level"
});

export function normalizeEffectValueMode(valueMode) {
    return valueMode === EFFECT_VALUE_MODES.PER_ORIGIN_LEVEL
        ? EFFECT_VALUE_MODES.PER_ORIGIN_LEVEL
        : EFFECT_VALUE_MODES.FIXED;
}

export function resolveOriginLevel(sourceItem) {
    const level = Number(sourceItem?.system?.level);
    return Number.isFinite(level) && level > 0 ? level : 1;
}

export function resolveEffectActionValue(baseValue, valueMode, sourceItem) {
    const normalizedMode = normalizeEffectValueMode(valueMode);
    if (normalizedMode === EFFECT_VALUE_MODES.FIXED) return baseValue;

    const numericBaseValue = Number(baseValue);
    return (Number.isFinite(numericBaseValue) ? numericBaseValue : 0) * resolveOriginLevel(sourceItem);
}

export function resolveEffectValueMetadata(baseValue, valueMode, sourceItem) {
    const normalizedMode = normalizeEffectValueMode(valueMode);
    const originLevel = resolveOriginLevel(sourceItem);
    return {
        baseValue,
        valueMode: normalizedMode,
        originLevel,
        effectiveValue: resolveEffectActionValue(baseValue, normalizedMode, sourceItem),
        originItemId: sourceItem?.id ?? null,
        originItemUuid: sourceItem?.uuid ?? null
    };
}