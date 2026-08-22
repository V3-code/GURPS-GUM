import { resolveCharacterImage } from "./character-image.mjs";

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