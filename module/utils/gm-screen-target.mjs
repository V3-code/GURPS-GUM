/**
 * Resolve o ator e o token opcional associados a um card do Escudo do Mestre.
 * A resolução não exige uma cena ativa e preserva atores sintéticos de
 * combatentes quando o token não está na cena atualmente exibida.
 */
export function resolveGMScreenCardTarget({ actorId, tokenId, combatantId } = {}, { gameRef, canvasRef } = {}) {
    const combatant = combatantId ? gameRef?.combat?.combatants?.get?.(combatantId) : null;
    const canvasToken = tokenId ? canvasRef?.tokens?.get?.(tokenId) : null;
    const token = canvasToken || combatant?.token?.object || null;
    const actor = combatant?.actor || token?.actor || (actorId ? gameRef?.actors?.get?.(actorId) : null);

    return {
        actor: actor || null,
        token: token?.actor === actor ? token : null
    };
}

/**
 * Whether a GM Screen card represents one of the current user's targets.
 * Combat cards identify a specific token; character cards deliberately fall
 * back to any target token that belongs to the displayed actor.
 */
export function isGMScreenCardTargeted({ actor = null, token = null } = {}, targetedTokens = []) {
    const cardTokenId = token?.id ?? token?.document?.id ?? null;

    return Array.from(targetedTokens ?? []).some(target => {
        const targetTokenId = target?.id ?? target?.document?.id ?? null;
        if (cardTokenId) return targetTokenId === cardTokenId;

        const targetActor = target?.actor ?? target?.document?.actor ?? null;
        return Boolean(actor && targetActor?.id === actor.id);
    });
}

/** Return active non-GM users targeting the card, preserving their Foundry color. */
export function getGMScreenPlayerTargeters(card = {}, users = []) {
    return Array.from(users ?? [])
        .filter(user => user?.active && !user?.isGM && isGMScreenCardTargeted(card, user.targets))
        .map(user => {
            const color = String(user.color ?? "").trim();
            return {
                id: user.id,
                name: String(user.name || "?"),
                color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#9baec8"
            };
        });
}
