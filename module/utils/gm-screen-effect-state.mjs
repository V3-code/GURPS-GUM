/**
 * Classifica Active Effects criados pelo Escudo do Mestre para exibição nos
 * cards. Efeitos de combate ainda desabilitados são aplicações válidas e
 * permanecem visíveis enquanto aguardam o combate ou o próximo turno.
 */
export function getGMScreenEffectState(effect) {
    const gumFlags = effect?.flags?.gum || {};
    if (gumFlags.source !== "GM Screen") return { visible: false, pending: false, pendingReason: null };

    const duration = gumFlags.duration || {};
    const pendingReason = duration.pendingCombat === true
        ? "Aguardando combate"
        : (duration.pendingStart === true ? "Aguardando turno" : null);
    const pending = Boolean(effect?.disabled && pendingReason);

    return {
        visible: effect?.disabled !== true || pending,
        pending,
        pendingReason
    };
}