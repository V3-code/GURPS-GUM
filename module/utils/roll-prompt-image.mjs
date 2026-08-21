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
  return resolveCharacterImage(actor, {
    tokenImg: rollData.tokenImg,
    fallbackImg: rollData.img,
    fallback: "icons/svg/d20.svg",
    canvasRef
  });
}