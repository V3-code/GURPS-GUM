import test from "node:test";
import assert from "node:assert/strict";
import { availableAmmunition, applyAmmunition, ammunitionRollModifier, reconcileAmmunitionModifier } from "../module/utils/ammunition.mjs";

test("only linked, available ammunition can be selected", () => {
    const items = new Map([
        ["ready", { id: "ready", system: { quantity: 3, location: "carried", ammunition: { enabled: true } } }],
        ["stored", { id: "stored", system: { quantity: 5, stored: true, ammunition: { enabled: true } } }],
        ["empty", { id: "empty", system: { quantity: 0, ammunition: { enabled: true } } }],
        ["ordinary", { id: "ordinary", system: { quantity: 2, ammunition: { enabled: false } } }]
    ]);
    assert.deepEqual(availableAmmunition({ items }, { ammunition_ids: [...items.keys()] }).map(item => item.id), ["ready"]);
});

test("ammunition changes a copy of the attack damage profile", () => {
    const base = { main: { formula: "2d6", type: "perf", armor_divisor: 1 }, follow_up: { formula: "" }, fragmentation: { formula: "" } };
    const ammo = { system: { ammunition: {
        attack_modifier: -2,
        main: { formula: "1d6", operation: "add", type: "cort", armor_divisor: 2, divisor_operation: "multiply" },
        follow_up: { formula: "1d6", operation: "replace" }
    } } };
    const result = applyAmmunition(base, ammo);
    assert.deepEqual(result.main, { formula: "(2d6)+(1d6)", type: "cort", armor_divisor: 2 });
    assert.equal(result.follow_up.formula, "1d6");
    assert.equal(base.main.type, "perf");
    assert.equal(ammunitionRollModifier(ammo), -2);
});

test("changing or removing ammunition in confirmation applies the chosen modifier once", () => {
    assert.equal(reconcileAmmunitionModifier(4, -1, 2, true), 1);
    assert.equal(reconcileAmmunitionModifier(4, 0, 2, true), 2);
    assert.equal(reconcileAmmunitionModifier(2, -1, 0, false), 1);
});
