/**
 * Exibe uma rolagem no Dice So Nice quando ela não será incorporada a uma
 * ChatMessage. Rolagens com mensagem são exibidas pelo próprio hook do módulo.
 */
export function showDiceForMessageLessRoll(roll, {
  createChatMessage = true,
  dice3d,
  user,
  whisper = null,
  blind = false,
  logger = console
} = {}) {
  if (createChatMessage !== false || typeof dice3d?.showForRoll !== "function") return false;

  // O Promise retornado pelo módulo só conclui ao fim da animação. A exibição
  // precisa ser disparada sem bloquear o fechamento do prompt nem o registro
  // do resultado no card da solicitação.
  Promise.resolve()
    .then(() => dice3d.showForRoll(roll, user, true, whisper, Boolean(blind)))
    .catch(error => {
      // A integração visual é opcional e nunca deve impedir o resultado do teste.
      logger?.warn?.("GUM | Não foi possível exibir a rolagem no Dice So Nice.", error);
    });
  return true;
}