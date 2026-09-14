import test from "node:test";
import assert from "node:assert/strict";

import { AUTO_SIZE_MODIFIER_MODES, calculateAttackSizeModifier } from "../module/utils/size-modifier.mjs";

test("regra básica aplica diretamente o MT final do alvo", () => {
  assert.deepEqual(calculateAttackSizeModifier(2, -1, AUTO_SIZE_MODIFIER_MODES.TARGET), {
    mode: "target",
    sourceMT: 2,
    targetMT: -1,
    modifier: -1,
    label: "MT do alvo (-1)"
  });
});

test("regra relativa subtrai o MT da origem do MT do alvo", () => {
  assert.equal(calculateAttackSizeModifier(2, -1, AUTO_SIZE_MODIFIER_MODES.RELATIVE)?.modifier, -3);
  assert.equal(calculateAttackSizeModifier(-2, 1, AUTO_SIZE_MODIFIER_MODES.RELATIVE)?.modifier, 3);
});

test("regra relativa preserva resultado zero e detalha os operandos", () => {
  assert.deepEqual(calculateAttackSizeModifier("3", "3", AUTO_SIZE_MODIFIER_MODES.RELATIVE), {
    mode: "relative",
    sourceMT: 3,
    targetMT: 3,
    modifier: 0,
    label: "MT relativo (alvo +3 − origem +3)"
  });
});

test("modos inválidos e valores ausentes não produzem modificador", () => {
  assert.equal(calculateAttackSizeModifier(0, 0, AUTO_SIZE_MODIFIER_MODES.OFF), null);
  assert.equal(calculateAttackSizeModifier(0, null, AUTO_SIZE_MODIFIER_MODES.TARGET), null);
  assert.equal(calculateAttackSizeModifier(undefined, 1, AUTO_SIZE_MODIFIER_MODES.RELATIVE), null);
});