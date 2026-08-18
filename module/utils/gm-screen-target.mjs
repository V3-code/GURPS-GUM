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