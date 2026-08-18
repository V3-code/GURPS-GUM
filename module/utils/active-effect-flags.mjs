function getEffects(actor) {
    const effects = actor?.effects;
    if (!effects) return [];
    if (Array.isArray(effects)) return effects;
    if (Array.isArray(effects.contents)) return effects.contents;
    try {
        return Array.from(effects);
    } catch (_error) {
        return [];
    }
}

function getProperty(object, path) {
    return path.split(".").reduce((value, part) => value?.[part], object);
}

function isEffectAvailable(effect) {
    if (!effect || effect.disabled === true || effect.active === false) return false;
    if (effect.suppressed === true || effect.isSuppressed === true) return false;
    if (effect.expired === true || effect.isExpired === true || effect.duration?.expired === true) return false;
    return true;
}

function valuesMatch(actualValue, expectedValue) {
    if (expectedValue === true) return actualValue === true || actualValue === "true";
    if (expectedValue === false) return actualValue === false || actualValue === "false";
    return actualValue === expectedValue;
}

/**
 * Return every available ActiveEffect on an actor that grants a mechanical flag.
 *
 * @param {object} actor Actor whose embedded ActiveEffects will be inspected.
 * @param {string} key Flag key below the configured namespace.
 * @param {object} options Query configuration.
 * @param {string} [options.namespace="gum"] Flag namespace.
 * @param {*} [options.expectedValue=true] Value an effect must grant.
 * @returns {object[]} Matching ActiveEffect documents.
 */
export function getActiveEffectFlagSources(actor, key, { namespace = "gum", expectedValue = true } = {}) {
    if (!actor || typeof key !== "string" || !key.trim()) return [];
    const path = `flags.${namespace}.${key}`;

    return getEffects(actor).filter(effect =>
        isEffectAvailable(effect) && valuesMatch(getProperty(effect, path), expectedValue)
    );
}

/** Check whether any available ActiveEffect on an actor grants a flag value. */
export function hasActiveEffectFlag(actor, key, expectedValue = true) {
    return getActiveEffectFlagSources(actor, key, { expectedValue }).length > 0;
}