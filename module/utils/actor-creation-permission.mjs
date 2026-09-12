/**
 * Indica se o usuário pode criar atores no mundo atual.
 *
 * Mestres sempre têm acesso; para jogadores, o Foundry considera a permissão
 * ACTOR_CREATE configurada em Configurar jogadores.
 */
export function canUserCreateActors(user) {
    return Boolean(user?.isGM || user?.can?.("ACTOR_CREATE"));
}