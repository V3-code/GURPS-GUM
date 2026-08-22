import test from "node:test";
import assert from "node:assert/strict";

import {
    normalizeEffectValueMode,
    resolveEffectActionValue,
    resolveEffectValueMetadata
} from "../module/utils/effect-value-scaling.mjs";

const originAtLevel = (level) => ({ id: "talent", uuid: "Actor.actor.Item.talent", system: { level } });

test("efeitos antigos sem value_mode permanecem fixos", () => {
    assert.equal(normalizeEffectValueMode(undefined), "fixed");
    assert.equal(resolveEffectActionValue(1, undefined, originAtLevel(3)), 1);
});

test("modo fixed não usa o nível da origem", () => {
    assert.equal(resolveEffectActionValue(1, "fixed", originAtLevel(3)), 1);
});

test("modo per_origin_level multiplica valores positivos e negativos", () => {
    assert.equal(resolveEffectActionValue(1, "per_origin_level", originAtLevel(1)), 1);
    assert.equal(resolveEffectActionValue("1", "per_origin_level", originAtLevel("2")), 2);
    assert.equal(resolveEffectActionValue(-1, "per_origin_level", originAtLevel(2)), -2);
});

test("nível ausente ou inválido usa nível 1", () => {
    assert.equal(resolveEffectActionValue(2, "per_origin_level", {}), 2);
    assert.equal(resolveEffectActionValue(2, "per_origin_level", originAtLevel("inválido")), 2);
    assert.equal(resolveEffectActionValue(2, "per_origin_level", originAtLevel(0)), 2);
});

test("sincronizações consecutivas sempre partem do valor-base", () => {
    const canonicalEntry = { value: 1, value_mode: "per_origin_level" };
    const first = resolveEffectValueMetadata(canonicalEntry.value, canonicalEntry.value_mode, originAtLevel(2));
    const second = resolveEffectValueMetadata(canonicalEntry.value, canonicalEntry.value_mode, originAtLevel(2));

    assert.equal(first.effectiveValue, 2);
    assert.equal(second.effectiveValue, 2);
    assert.deepEqual(canonicalEntry, { value: 1, value_mode: "per_origin_level" });
});

test("serialização JSON preserva value_mode", () => {
    const item = {
        system: {
            actions: [{
                type: "roll_modifier",
                roll_modifier_entries: [{ value: 1, value_mode: "per_origin_level" }]
            }]
        }
    };
    const restored = JSON.parse(JSON.stringify(item));
    assert.equal(restored.system.actions[0].roll_modifier_entries[0].value_mode, "per_origin_level");
});