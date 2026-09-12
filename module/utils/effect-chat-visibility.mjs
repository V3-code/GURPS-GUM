export const ATTRIBUTE_CHAT_VISIBILITIES = Object.freeze({
  public: "Público",
  owners: "Donos e Mestre",
  gm: "Somente Mestre",
  none: "Não mostrar"
});

export const normalizeAttributeChatVisibility = (value) => (
  Object.hasOwn(ATTRIBUTE_CHAT_VISIBILITIES, value) ? value : "public"
);

const rollModeCreationOptions = (mode, generation = 12) => (
  Number(generation) >= 14 ? { messageMode: mode } : { rollMode: mode }
);

export const getAttributeRollMessageOptions = ({ visibility, actor, users = [], generation = 12 } = {}) => {
  const normalized = normalizeAttributeChatVisibility(visibility);
  if (normalized === "none") return null;
  if (normalized === "public") {
    return { messageData: {}, creationOptions: rollModeCreationOptions("publicroll", generation) };
  }
  if (normalized === "gm") {
    // O modo blindroll nativo é o único que restringe o resultado aos GMs.
    // gmroll também permite que o usuário que criou a mensagem veja a rolagem.
    return { messageData: {}, creationOptions: rollModeCreationOptions("blindroll", generation) };
  }

  const recipients = Array.from(users)
    .filter((user) => user?.isGM || actor?.testUserPermission?.(user, "OWNER"))
    .map((user) => user.id)
    .filter(Boolean);

  return {
    messageData: { whisper: [...new Set(recipients)] },
    creationOptions: {}
  };
};