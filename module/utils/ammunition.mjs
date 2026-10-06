export function availableAmmunition(actor, attack) {
    const ids = Array.isArray(attack?.ammunition_ids) ? attack.ammunition_ids : [];
    return ids.map(id => actor?.items?.get(id)).filter(item => item && item.system?.ammunition?.enabled &&
        !item.system?.stored && item.system?.location !== "stored" && Number(item.system?.quantity) > 0);
}

export function applyAmmunition(profile, ammunition) {
    const result = structuredClone(profile);
    const effects = ammunition?.system?.ammunition || ammunition || {};
    for (const key of ["main", "follow_up", "fragmentation"]) {
        const change = effects[key] || {};
        const component = result[key];
        if (!component) continue;
        if (String(change.formula || "").trim()) {
            const value = String(change.formula).trim();
            const original = String(component.formula || "0");
            component.formula = change.operation === "add" ? `(${original})+(${value})`
                : change.operation === "multiply" ? `(${original})*(${value})` : value;
        }
        for (const field of ["type", "nature"]) {
            if (String(change[field] || "").trim()) component[field] = String(change[field]).trim();
        }
        const divisor = Number(change.armor_divisor);
        if (change.armor_divisor !== "" && change.armor_divisor != null && Number.isFinite(divisor) && divisor > 0) {
            component.armor_divisor = change.divisor_operation === "multiply"
                ? Number(component.armor_divisor || 1) * divisor
                : change.divisor_operation === "add" ? Number(component.armor_divisor || 1) + divisor : divisor;
        }
    }
    return result;
}

export function ammunitionRollModifier(ammunition) {
    return Number(ammunition?.system?.ammunition?.attack_modifier) || 0;
}

export function reconcileAmmunitionModifier(rollModifier, selectedModifier, promptModifier = 0, includedInPrompt = false) {
    return (Number(rollModifier) || 0) + (Number(selectedModifier) || 0)
        - (includedInPrompt ? Number(promptModifier) || 0 : 0);
}
