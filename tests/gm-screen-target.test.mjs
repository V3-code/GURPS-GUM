import test from "node:test";
import assert from "node:assert/strict";

import { getGMScreenPlayerTargeters, isGMScreenCardTargeted, resolveGMScreenCardTarget } from "../module/utils/gm-screen-target.mjs";

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

test("card de combate só é marcado quando seu token específico é alvo", () => {
    const actor = { id: "hero" };
    const cardToken = { id: "card-token", actor };
    const otherToken = { id: "other-token", actor };

    assert.equal(isGMScreenCardTargeted({ actor, token: cardToken }, [otherToken]), false);
    assert.equal(isGMScreenCardTargeted({ actor, token: cardToken }, [cardToken]), true);
});

test("card de personagem é marcado quando qualquer token do ator é alvo", () => {
    const actor = { id: "hero" };
    const target = { id: "token", actor };

    assert.equal(isGMScreenCardTargeted({ actor }, [target]), true);
    assert.equal(isGMScreenCardTargeted({ actor: { id: "other" } }, [target]), false);
});

test("retorna somente jogadores ativos que miram o card com suas cores", () => {
    const actor = { id: "hero" };
    const token = { id: "token", actor };
    const users = [
        { id: "player", name: "Ana", active: true, isGM: false, color: "#3a7bd5", targets: new Set([token]) },
        { id: "gm", name: "Mestre", active: true, isGM: true, color: "#ffffff", targets: new Set([token]) },
        { id: "away", name: "Beto", active: false, isGM: false, color: "#ff0000", targets: new Set([token]) },
        { id: "other", name: "Caio", active: true, isGM: false, color: "invalid", targets: new Set() }
    ];

    assert.deepEqual(getGMScreenPlayerTargeters({ actor, token }, users), [
        { id: "player", name: "Ana", color: "#3a7bd5" }
    ]);
});
