import test from "node:test";
import assert from "node:assert/strict";
import { canUserCreateActors } from "../module/utils/actor-creation-permission.mjs";

test("permite importar do GCS quando o jogador pode criar atores", () => {
    const user = {
        isGM: false,
        can: permission => permission === "ACTOR_CREATE"
    };

    assert.equal(canUserCreateActors(user), true);
});

test("não permite importar do GCS quando o jogador não pode criar atores", () => {
    const user = { isGM: false, can: () => false };

    assert.equal(canUserCreateActors(user), false);
});

test("mantém a importação disponível para mestres", () => {
    const user = { isGM: true, can: () => false };

    assert.equal(canUserCreateActors(user), true);
});