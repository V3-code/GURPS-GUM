import test from "node:test";
import assert from "node:assert/strict";
import { getActiveEffectFlagSources, hasActiveEffectFlag } from "../module/utils/active-effect-flags.mjs";

const effect = (value, extra = {}) => ({ name: extra.name || "Efeito", flags: { gum: { ignoreShock: value } }, ...extra });

test("aceita true booleano e textual e retorna todas as fontes", () => {
    const actor = { effects: [effect(true, { name: "A" }), effect("true", { name: "B" }), effect(false)] };
    assert.deepEqual(getActiveEffectFlagSources(actor, "ignoreShock").map(source => source.name), ["A", "B"]);
    assert.equal(hasActiveEffectFlag(actor, "ignoreShock"), true);
});

test("valores falsos ou ausentes não concedem a flag", () => {
    for (const value of [false, "false", null, undefined, ""]) {
        assert.equal(hasActiveEffectFlag({ effects: [effect(value)] }, "ignoreShock"), false);
    }
});

test("ignora efeitos desabilitados, suprimidos e expirados", () => {
    const actor = { effects: [
        effect(true, { disabled: true }),
        effect(true, { suppressed: true }),
        effect(true, { isSuppressed: true }),
        effect(true, { expired: true }),
        effect(true, { isExpired: true }),
        effect(true, { duration: { expired: true } })
    ] };
    assert.equal(hasActiveEffectFlag(actor, "ignoreShock"), false);
});

test("aceita coleções Foundry e entradas inválidas sem lançar", () => {
    assert.equal(hasActiveEffectFlag(null, "ignoreShock"), false);
    assert.equal(hasActiveEffectFlag({}, "ignoreShock"), false);
    assert.equal(hasActiveEffectFlag({ effects: { contents: [effect(true)] } }, "ignoreShock"), true);
});

test("um valor falso não cancela outra fonte verdadeira", () => {
    assert.equal(hasActiveEffectFlag({ effects: [effect(false), effect(true)] }, "ignoreShock"), true);
});