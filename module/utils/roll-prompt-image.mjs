const tokenTexture = token => token?.document?.texture?.src ?? token?.texture?.src ?? null;

const belongsToActor = (token, actor) => {
  const tokenActor = token?.actor ?? token?.document?.actor;
  return tokenActor === actor || (tokenActor?.id && tokenActor.id === actor?.id);
};

/**
 * Resolve a imagem de identidade da rolagem, preservando a aparência específica
 * do Token que originou a ação antes de recorrer ao retrato do Ator.
 */
export function resolveRollPromptImage(actor, rollData = {}, canvasRef = globalThis.canvas) {
  if (rollData.tokenImg) return rollData.tokenImg;

  const actorTokenImage = tokenTexture(actor?.token);
  if (actorTokenImage) return actorTokenImage;

  const controlledToken = Array.from(canvasRef?.tokens?.controlled ?? []).find(token => belongsToActor(token, actor));
  const controlledTokenImage = tokenTexture(controlledToken);
  if (controlledTokenImage) return controlledTokenImage;

  // getActiveTokens devolve os Tokens renderizados na cena atual. Mesmo para
  // um Ator vinculado, a textura pertence ao TokenDocument (não ao Ator), por
  // isso ela deve ser consultada antes de actor.img. O controlado acima ainda
  // vence quando há várias cópias do mesmo Ator na cena.
  const activeTokens = actor?.getActiveTokens?.() ?? [];
  const activeTokenImage = tokenTexture(activeTokens[0]);
  if (activeTokenImage) return activeTokenImage;

  return actor?.img || rollData.img || "icons/svg/d20.svg";
}