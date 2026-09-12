/** Return a stable key for one concrete Actor context. */
export function getActorEvaluationKey(actor) {
  // Synthetic actors reuse the base Actor id, while their UUID includes the
  // Token document and therefore distinguishes separate unlinked Tokens.
  return actor?.uuid || actor?.id || null;
}

/** Adapt an Actor to the token-shaped target expected by the effects engine. */
export function buildActorEffectTarget(actor) {
  if (!actor) return null;

  // Preserve the Token only when it is the context which owns this synthetic
  // Actor. Active Tokens of a world Actor must never replace that Actor as the
  // mechanical owner of an automatically evaluated effect.
  if (actor.isToken && actor.token) {
    const token = actor.token.object || actor.token;
    if (token.actor === actor) return token;
  }

  return {
    actor,
    id: null,
    name: actor.name || "Alvo",
    document: {
      uuid: null,
      texture: { src: actor.img || "icons/svg/mystery-man.svg" }
    }
  };
}

export function buildActorEffectTargets(actor) {
  const target = buildActorEffectTarget(actor);
  return target ? [target] : [];
}