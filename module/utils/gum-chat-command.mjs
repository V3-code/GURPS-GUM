const fold = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

const NH_ALIASES = new Set(["nh", "n", "niv", "nivel"]);
const DAMAGE_ALIASES = new Set(["dmg", "d", "damage", "dano"]);
const HELP_ALIASES = new Set(["help", "ajuda"]);
const INTERCEPTED_CHAT_LOGS = new WeakSet();

/** Convert Foundry's plain-text or rich-text chat payload into command text. */
export function gumChatInputText(input) {
  let value = input;
  if (value && typeof value === "object") {
    value = value.content ?? value.message ?? value.text ?? value.textContent ?? "";
  }
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&sol;|&#47;|&#x2f;/gi, "/")
    .replace(/&plus;|&#43;|&#x2b;/gi, "+")
    .replace(/&minus;|&#45;|&#x2d;/gi, "-")
    .trim();
}

export function parseNhExpression(value) {
  const compact = String(value ?? "").replace(/\s+/g, "");
  const match = compact.match(/^(\d+)([+-]\d+)?$/);
  if (!match) return null;
  return { value: Number(match[1]), modifier: Number(match[2] ?? 0) };
}

export function splitSkillModifier(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(.*?)([+-]\s*\d+)$/);
  if (!match || !match[1].trim()) return { name: raw, modifier: 0 };
  return { name: match[1].trim(), modifier: Number(match[2].replace(/\s+/g, "")) };
}

export function isSafeDamageFormula(value) {
  const compact = String(value ?? "").replace(/\s+/g, "").toLowerCase();
  return /^(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(compact);
}

export function isSafeDamageType(value) {
  return /^[\p{L}\p{N}+._-]+$/u.test(String(value ?? "").trim());
}

export function parseGumChatCommand(message) {
  const match = gumChatInputText(message).match(/^\/gum(?:\s+(.*))?$/i);
  if (!match) return null;
  const body = String(match[1] ?? "").trim();
  if (!body) return { type: "help" };

  const [rawCommand, ...rest] = body.split(/\s+/);
  const command = fold(rawCommand);
  if (HELP_ALIASES.has(command)) return { type: "help", topic: fold(rest[0] ?? "") };

  if (NH_ALIASES.has(command)) {
    const expression = parseNhExpression(rest.join(""));
    return expression ? { type: "nh", ...expression } : { type: "error", reason: "nh" };
  }

  if (DAMAGE_ALIASES.has(command)) {
    if (rest.length < 2) return { type: "error", reason: "damage" };
    const formula = rest[0].toLowerCase();
    const damageType = rest.slice(1).join(" ").trim();
    return isSafeDamageFormula(formula) && isSafeDamageType(damageType)
      ? { type: "damage", formula, damageType }
      : { type: "error", reason: "damage" };
  }

  return { type: "skill", query: body };
}

export function normalizeGumLookup(value) {
  return fold(value);
}

/** Resolve the actor context without requiring its token to be present in a scene. */
export function resolveGumCommandActor({ controlledTokens = [], assignedActor = null, actors = [], user = null } = {}) {
  const controlled = Array.from(controlledTokens ?? []).filter(token => token?.actor);
  if (controlled.length === 1) return { actor: controlled[0].actor, multiple: false, ambiguousOwners: false };
  if (controlled.length > 1) return { actor: null, multiple: true, ambiguousOwners: false };
  if (assignedActor) return { actor: assignedActor, multiple: false, ambiguousOwners: false };

  // A GM deliberately falls through to the actor-less narrative roll. Since a
  // GM owns every world actor, ownership cannot identify a meaningful sheet.
  if (!user || user.isGM) return { actor: null, multiple: false, ambiguousOwners: false };
  const owned = Array.from(actors ?? []).filter(actor => {
    if (!actor || actor.type !== "character") return false;
    if (typeof actor.testUserPermission === "function") return actor.testUserPermission(user, "OWNER");
    return Number(actor.ownership?.[user.id] ?? 0) >= 3;
  });
  return {
    actor: owned.length === 1 ? owned[0] : null,
    multiple: false,
    ambiguousOwners: owned.length > 1
  };
}

/**
 * Intercept GUM commands before Foundry validates its built-in slash commands.
 * Foundry 14 rejects unknown slash commands before emitting the legacy
 * chatMessage hook, so that hook cannot be used as the primary integration.
 */
export function installGumChatCommandInterceptor(chatLog, execute, parse = parseGumChatCommand) {
  if (!chatLog || typeof chatLog.processMessage !== "function" || typeof execute !== "function") return false;
  if (INTERCEPTED_CHAT_LOGS.has(chatLog)) return true;

  const originalProcessMessage = chatLog.processMessage;
  chatLog.processMessage = async function(message, ...args) {
    const command = parse(message);
    if (!command) return originalProcessMessage.call(this, message, ...args);
    await execute(command);
    return null;
  };
  INTERCEPTED_CHAT_LOGS.add(chatLog);
  return true;
}