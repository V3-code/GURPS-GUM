export function recipientUserIdsForActor(actor, users = []) {
  const activePlayers = users.filter(user => user.active && !user.isGM);
  const assigned = activePlayers.filter(user => user.character?.id === actor?.id).map(user => user.id);
  if (assigned.length) return assigned;
  return activePlayers.filter(user => actor?.testUserPermission?.(user, "OWNER") || actor?.ownership?.[user.id] === 3).map(user => user.id);
}

function actorOwnershipGroup(actor, users = []) {
  const players = users.filter(user => !user.isGM);
  const assigned = players.filter(user => user.character?.id === actor?.id);
  if (assigned.some(user => user.active)) return "Personagens atribuídos a jogadores ativos";
  if (assigned.length) return "Personagens atribuídos a jogadores offline";
  const owners = players.filter(user => actor?.testUserPermission?.(user, "OWNER") || actor?.ownership?.[user.id] === 3);
  if (owners.some(user => user.active)) return "Personagens com proprietário ativo";
  if (owners.length) return "Personagens com proprietário offline";
  return "Personagens sem jogador proprietário/NPCs";
}

export function isUserAuthorizedForTarget(user, actor, target = {}) {
  if (user?.isGM) return true;
  if (!user?.active || !actor) return false;
  return user.character?.id === actor.id || actor.testUserPermission?.(user, "OWNER") || actor.ownership?.[user.id] === 3;
}

export function buildTestRequestTargets({ actors = [], tokens = [], users = [], selectedTokenIds = [] } = {}) {
  const targets = new Map();
  const selected = new Set(selectedTokenIds);
  for (const token of tokens) {
    const actor = token.actor;
    if (!actor) continue;
    const synthetic = actor.isToken || token.document?.actorLink === false || token.actorLink === false;
    // A linked token can retain a stale Actor instance on the canvas after its
    // world actor has been deleted. It is not a valid request target anymore.
    if (!synthetic && !actors.some(worldActor => worldActor?.id === actor.id)) continue;
    const tokenUuid = synthetic ? (token.document?.uuid ?? token.uuid) : null;
    const actorUuid = actor.uuid;
    const targetKey = tokenUuid || actorUuid;
    targets.set(targetKey, { targetKey, actorUuid, tokenUuid, actorName: actor.name, actorImg: actor.img, recipientUserIds: recipientUserIdsForActor(actor, users), selected: selected.has(token.id ?? token.document?.id), group: selected.has(token.id ?? token.document?.id) ? "Tokens selecionados" : "Combatentes" });
  }
  for (const actor of actors) {
    if (!actor?.uuid || targets.has(actor.uuid)) continue;
    const recipients = recipientUserIdsForActor(actor, users);
    targets.set(actor.uuid, { targetKey: actor.uuid, actorUuid: actor.uuid, tokenUuid: null, actorName: actor.name, actorImg: actor.img, recipientUserIds: recipients, selected: false, group: actorOwnershipGroup(actor, users) });
  }
  return [...targets.values()];
}