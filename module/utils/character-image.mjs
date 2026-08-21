const tokenTexture = token => token?.document?.texture?.src ?? token?.texture?.src ?? null;

const tokenActor = token => token?.actor ?? token?.document?.actor ?? null;

const belongsToActor = (token, actor) => {
  const candidate = tokenActor(token);
  return candidate === actor || (candidate?.id && candidate.id === actor?.id);
};

/**
 * Resolve a imagem usada para identificar um personagem em uma cena.
 *
 * A aparência do Token vence o retrato do Ator sintético associado a ele;
 * somente depois é usado o retrato da ficha de origem. Quando não há um Token
 * explícito, um Token controlado ou o único Token ativo do Ator pode fornecer
 * o contexto sem escolher arbitrariamente entre cópias diferentes.
 */
export function resolveCharacterImage(actor, {
  token = null,
  tokenImg = null,
  sourceActor = null,
  fallbackImg = null,
  fallback = "icons/svg/mystery-man.svg",
  canvasRef = globalThis.canvas
} = {}) {
  if (tokenImg) return tokenImg;

  const actorToken = token ?? actor?.token ?? null;
  const actorTokenTexture = tokenTexture(actorToken);
  if (actorTokenTexture) return actorTokenTexture;
  const actorTokenPortrait = tokenActor(actorToken)?.img;
  if (actorTokenPortrait) return actorTokenPortrait;

  const controlledToken = Array.from(canvasRef?.tokens?.controlled ?? [])
    .find(candidate => belongsToActor(candidate, actor));
  const controlledTexture = tokenTexture(controlledToken);
  if (controlledTexture) return controlledTexture;
  const controlledPortrait = tokenActor(controlledToken)?.img;
  if (controlledPortrait) return controlledPortrait;

  const activeTokens = actor?.getActiveTokens?.() ?? [];
  if (activeTokens.length === 1) {
    const activeTexture = tokenTexture(activeTokens[0]);
    if (activeTexture) return activeTexture;
    const activePortrait = tokenActor(activeTokens[0])?.img;
    if (activePortrait) return activePortrait;
  }

  return actor?.img || sourceActor?.img || fallbackImg || fallback;
}

export { tokenTexture };