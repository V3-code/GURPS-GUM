const ITEM_COMPENDIUM_COMPATIBILITY_MARKER = Symbol.for("gum.itemCompendiumExportSourceCompatibility");

/**
 * Remove Foundry's deprecated, non-enumerable flags.exportSource compatibility shim.
 *
 * Foundry v13/v14 adds this getter when Item#toObject is called. Item#toCompendium
 * can carry it into the next Item constructor, which then treats it as legacy input
 * and emits a deprecation warning even though the original Item already uses _stats.
 */
export function removeLegacyExportSourceShim(data) {
    const flags = data?.flags;
    if (!flags || !Object.prototype.hasOwnProperty.call(flags, "exportSource")) return data;
    delete flags.exportSource;
    return data;
}

/** Install the compatibility cleanup on Item compendium serialization once. */
export function installItemCompendiumExportSourceCompatibility(ItemClass = globalThis.CONFIG?.Item?.documentClass) {
    const prototype = ItemClass?.prototype;
    if (!prototype || prototype[ITEM_COMPENDIUM_COMPATIBILITY_MARKER]) return false;

    const originalToCompendium = prototype.toCompendium;
    if (typeof originalToCompendium !== "function") return false;

    Object.defineProperty(prototype, "toCompendium", {
        configurable: true,
        writable: true,
        value(pack, options) {
            return removeLegacyExportSourceShim(originalToCompendium.call(this, pack, options));
        }
    });
    Object.defineProperty(prototype, ITEM_COMPENDIUM_COMPATIBILITY_MARKER, {
        configurable: true,
        value: true
    });
    return true;
}
