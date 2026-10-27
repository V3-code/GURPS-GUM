const RESOURCE_KEYS = Object.freeze(["hp", "fp"]);

function readChange(changes, path) {
  if (!changes || typeof changes !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(changes, path)) return changes[path];
  return path.split(".").reduce((value, key) => value && typeof value === "object" ? value[key] : undefined, changes);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function captureActorResourceChanges(actor, changes, { eventData = null, eventIdFactory = null } = {}) {
  const captured = [];
  for (const resource of RESOURCE_KEYS) {
    const nextValue = finiteNumber(readChange(changes, `system.attributes.${resource}.value`));
    if (nextValue === null) continue;

    const current = actor?.system?.attributes?.[resource] || {};
    const previousValue = finiteNumber(current.value);
    if (previousValue === null || previousValue === nextValue) continue;

    const changedMaximum = finiteNumber(readChange(changes, `system.attributes.${resource}.final`))
      ?? finiteNumber(readChange(changes, `system.attributes.${resource}.max`));
    const maximum = changedMaximum ?? finiteNumber(current.final) ?? finiteNumber(current.max) ?? 0;
    const parentEventId = eventData?.eventId ? String(eventData.eventId) : null;
    const generatedId = eventIdFactory?.() ?? `${Date.now()}-${resource}`;
    const eventId = parentEventId ? `${parentEventId}:${resource}-change` : String(generatedId);
    const payload = {
      type: "resource_change",
      eventId,
      resource,
      path: `system.attributes.${resource}.value`,
      before: previousValue,
      after: nextValue,
      maximum,
      delta: nextValue - previousValue,
      direction: nextValue < previousValue ? "decrease" : "increase",
      source: eventData ? { type: eventData.type || "actor_update", eventId: parentEventId } : { type: "actor_update", eventId: null }
    };

    // Aliases keep threshold formulas concise and make migration from damage
    // events possible without losing the explicit resource-neutral fields.
    if (resource === "hp") {
      Object.assign(payload, { appliedToHP: true, hpBefore: previousValue, hpAfter: nextValue, hpMaximum: maximum });
    } else {
      Object.assign(payload, { appliedToFP: true, fpBefore: previousValue, fpAfter: nextValue, fpMaximum: maximum });
    }
    captured.push(payload);
  }
  return captured;
}
