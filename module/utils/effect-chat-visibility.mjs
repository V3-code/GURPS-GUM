import { recipientUserIdsForActor } from "./test-request-targets.mjs";

export const ATTRIBUTE_CHAT_VISIBILITIES = Object.freeze({
  public: "Público",
  owners: "Donos e Mestre",
  gm: "Somente Mestre",
  none: "Não mostrar"
});

export const RESISTANCE_CHAT_VISIBILITIES = Object.freeze({
  public: "Público (todos)",
  owners: "Alvo e Mestre",
  target: "Somente o alvo"
});

export const normalizeAttributeChatVisibility = (value) => (
  Object.hasOwn(ATTRIBUTE_CHAT_VISIBILITIES, value) ? value : "public"
);


export const normalizeResistanceChatVisibility = (value) => (
  Object.hasOwn(RESISTANCE_CHAT_VISIBILITIES, value) ? value : "owners"
);

export const getResistanceChatPrivacy = ({ visibility, actor, users = [] } = {}) => {
  const normalized = normalizeResistanceChatVisibility(visibility);
  if (normalized === "public") return { mode: "publicroll", whisper: [] };

  const activeUsers = Array.from(users).filter(user => user?.active);
  const targetIds = new Set(recipientUserIdsForActor(actor, activeUsers));
  const targets = activeUsers.filter(user => targetIds.has(user.id));
  const gms = activeUsers.filter(user => user.isGM);
  const recipients = normalized === "owners" ? [...targets, ...gms] : targets.length ? targets : gms;

  return {
    mode: null,
    whisper: [...new Set(recipients.map(user => user.id).filter(Boolean))]
  };
};

const MESSAGE_MODE_BY_ROLL_MODE = Object.freeze({
  publicroll: "public",
  selfroll: "self",
  gmroll: "gm",
  blindroll: "blind"
});

const rollModeCreationOptions = (mode, generation = 12) => {
  if (Number(generation) >= 14) {
    return { messageMode: MESSAGE_MODE_BY_ROLL_MODE[mode] ?? mode };
  }
  return { rollMode: mode };
};

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