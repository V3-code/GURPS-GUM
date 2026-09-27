import assert from "node:assert/strict";
import test from "node:test";

import { evaluateModifierRollFormulaSync } from "../module/utils/modifier-roll-formula.mjs";

test("avalia fórmula de dados pelo caminho síncrono moderno", () => {
    class FakeRoll {
        constructor(formula, data) {
            assert.equal(formula, "1d6+2");
            assert.deepEqual(data, { bonus: 2 });
        }
        evaluateSync() {
            this.total = 6;
            return this;
        }
    }
    assert.equal(evaluateModifierRollFormulaSync("1d6+2", { bonus: 2 }, FakeRoll), 6);
});

test("mantém compatibilidade com evaluate async:false", () => {
    class LegacyRoll {
        evaluate(options) {
            assert.deepEqual(options, { async: false });
            this.total = 4;
            return this;
        }
    }
    assert.equal(evaluateModifierRollFormulaSync("1d6", {}, LegacyRoll), 4);
});

test("não captura números, referências ou avaliadores realmente assíncronos", () => {
    class AsyncRoll {
        evaluate() { return Promise.resolve(this); }
    }
    assert.equal(evaluateModifierRollFormulaSync("12", {}, AsyncRoll), null);
    assert.equal(evaluateModifierRollFormulaSync("DX + 1", {}, AsyncRoll), null);
    assert.equal(evaluateModifierRollFormulaSync("2d6", {}, AsyncRoll), null);
});
