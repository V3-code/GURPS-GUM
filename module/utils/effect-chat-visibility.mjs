export const ATTRIBUTE_CHAT_VISIBILITIES = Object.freeze({
  public: "Público",
  owners: "Donos e Mestre",
  gm: "Somente Mestre",
  none: "Não mostrar"
});

export const normalizeAttributeChatVisibility = (value) => (
  Object.hasOwn(ATTRIBUTE_CHAT_VISIBILITIES, value) ? value : "public"
);

export const getAttributeRollMessageOptions = ({ visibility, actor, users = [] } = {}) => {
  const normalized = normalizeAttributeChatVisibility(visibility);
  if (normalized === "none") return null;
  if (normalized === "public") {
    return { messageData: {}, creationOptions: { rollMode: "publicroll" } };
  }
  if (normalized === "gm") {
    // O modo blindroll nativo é o único que restringe o resultado aos GMs.
    // gmroll também permite que o usuário que criou a mensagem veja a rolagem.
    return { messageData: {}, creationOptions: { rollMode: "blindroll" } };
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