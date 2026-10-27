export const CONDITION_EFFECT_PHASES = Object.freeze(["always", "enter", "turnStart", "event", "exit"]);

export function normalizeConditionEffectLink(link = {}) {
  const phase = CONDITION_EFFECT_PHASES.includes(link.phase) ? link.phase : "always";
  const removeOnConditionEnd = ![false, "false", 0, "0"].includes(link.removeOnConditionEnd);
  return {
    ...link,
    phase,
    removeOnConditionEnd
  };
}

export function normalizeConditionEffectLinks(links = []) {
  const entries = Array.isArray(links)
    ? links
    : links && typeof links === "object"
      ? Object.entries(links)
          .sort(([left], [right]) => {
            const leftNumber = Number(left);
            const rightNumber = Number(right);
            if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) return leftNumber - rightNumber;
            return String(left).localeCompare(String(right));
          })
          .map(([, link]) => link)
      : [];
  return entries.filter(link => link && typeof link === "object").map(normalizeConditionEffectLink);
}

export function shouldExecuteConditionEffectLink(link, execution = {}) {
  const { phase } = normalizeConditionEffectLink(link);
  if (phase === "always") return Boolean(execution.enter || execution.event || execution.turnStart);
  if (phase === "enter") return Boolean(execution.enter);
  if (phase === "event") return Boolean(execution.event);
  if (phase === "turnStart") return Boolean(execution.turnStart);
  if (phase === "exit") return Boolean(execution.exit);
  return false;
}

export class ConditionEventDeduper {
  constructor({ ttl = 60_000, now = () => Date.now() } = {}) {
    this.ttl = ttl;
    this.now = now;
    this.seen = new Map();
  }

  claim(actorKey, eventId) {
    if (!actorKey || !eventId) return true;
    const timestamp = this.now();
    for (const [key, seenAt] of this.seen) {
      if (timestamp - seenAt > this.ttl) this.seen.delete(key);
    }
    const key = `${actorKey}:${eventId}`;
    if (this.seen.has(key)) return false;
    this.seen.set(key, timestamp);
    return true;
  }
}
