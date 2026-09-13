import test from "node:test";
import assert from "node:assert/strict";
import { canUserCreateActors, canUserImportIntoActor } from "../module/utils/actor-creation-permission.mjs";

test("permite criar ator pela importação do diretório quando autorizado", () => {
    const user = {
        isGM: false,
        can: permission => permission === "ACTOR_CREATE"
    };

    assert.equal(canUserCreateActors(user), true);
});

test("permite importar na ficha possuída sem exigir criação de atores", () => {
    const user = { isGM: false, can: () => false };
    assert.equal(canUserImportIntoActor(user, { type: "character", isOwner: true }), true);
});

test("impede importar em ficha alheia ou que não seja de personagem", () => {
    const user = { isGM: false };
    assert.equal(canUserImportIntoActor(user, { type: "character", isOwner: false }), false);
    assert.equal(canUserImportIntoActor(user, { type: "npc", isOwner: true }), false);
});

test("não permite criar ator pela importação do diretório sem autorização", () => {
    const user = { isGM: false, can: () => false };

    assert.equal(canUserCreateActors(user), false);
});

test("mantém a importação disponível para mestres", () => {
    const user = { isGM: true, can: () => false };

    assert.equal(canUserCreateActors(user), true);
});