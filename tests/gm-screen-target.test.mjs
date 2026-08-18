import test from "node:test";
import assert from "node:assert/strict";

import { resolveGMScreenCardTarget } from "../module/utils/gm-screen-target.mjs";

const collection = (entries) => new Map(entries);

test("card de PJ resolve o ator global sem cena ou token", () => {
    const actor = { id: "hero" };
    const gameRef = { actors: collection([[actor.id, actor]]) };

    assert.deepEqual(
        resolveGMScreenCardTarget({ actorId: actor.id }, { gameRef, canvasRef: null }),
        { actor, token: null }
    );
});

test("card de combate preserva ator sintético sem token renderizado", () => {
    const actor = { id: "synthetic" };
    const combatant = { id: "combatant", actor, token: { object: null } };
    const gameRef = {
        actors: collection([]),
        combat: { combatants: collection([[combatant.id, combatant]]) }
    };

    assert.deepEqual(
        resolveGMScreenCardTarget(
            { actorId: actor.id, tokenId: "missing", combatantId: combatant.id },
            { gameRef, canvasRef: null }
        ),
        { actor, token: null }
    );
});

test("card de combate usa o token da cena quando ele pertence ao ator resolvido", () => {
    const actor = { id: "hero" };
    const token = { id: "token", actor };
    const combatant = { id: "combatant", actor };
    const gameRef = {
        actors: collection([[actor.id, actor]]),
        combat: { combatants: collection([[combatant.id, combatant]]) }
    };
    const canvasRef = { tokens: collection([[token.id, token]]) };

    assert.deepEqual(
        resolveGMScreenCardTarget(
            { actorId: actor.id, tokenId: token.id, combatantId: combatant.id },
            { gameRef, canvasRef }
        ),
        { actor, token }
    );
});

test("token de outro ator não substitui o alvo do combatente", () => {
    const actor = { id: "combat-actor" };
    const otherActor = { id: "other" };
    const token = { id: "stale-token", actor: otherActor };
    const combatant = { id: "combatant", actor };
    const gameRef = { combat: { combatants: collection([[combatant.id, combatant]]) } };
    const canvasRef = { tokens: collection([[token.id, token]]) };

    assert.deepEqual(
        resolveGMScreenCardTarget(
            { tokenId: token.id, combatantId: combatant.id },
            { gameRef, canvasRef }
        ),
        { actor, token: null }
    );
});