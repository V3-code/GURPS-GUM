/**
 * Indica se o usuário pode criar atores no mundo atual.
 *
 * Mestres sempre têm acesso; para jogadores, o Foundry considera a permissão
 * ACTOR_CREATE configurada em Configurar jogadores.
 */
export function canUserCreateActors(user) {
    return Boolean(user?.isGM || user?.can?.("ACTOR_CREATE"));
}

/** Indica se o usuário pode importar dados para este Ator específico. */
export function canUserImportIntoActor(user, actor) {
    if (!actor || actor.type !== "character") return false;
    return Boolean(user?.isGM || actor.isOwner);
}