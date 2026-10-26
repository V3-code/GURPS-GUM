import assert from "node:assert/strict";
import test from "node:test";
import { formatDistanceModifier, getDistanceModifier } from "../module/utils/distance-modifier.mjs";

test("resolve os limites da tabela padrão", () => {
  assert.equal(getDistanceModifier(2, "standard"), 0);
  assert.equal(getDistanceModifier(3, "standard"), -1);
  assert.equal(getDistanceModifier(20, "standard"), -6);
  assert.equal(getDistanceModifier(20.01, "standard"), -7);
  assert.equal(getDistanceModifier(250000, "standard"), -31);
});

test("resolve as tabelas resumida e híbrida pela mesma função", () => {
  assert.equal(getDistanceModifier(20, "monster_hunters"), -3);
  assert.equal(getDistanceModifier(21, "monster_hunters"), -7);
  assert.equal(getDistanceModifier(10, "hybrid"), -3);
  assert.equal(getDistanceModifier(15, "hybrid"), -5);
  assert.equal(getDistanceModifier(20, "hybrid"), -6);
});

test("formata o modificador para apresentação sem alterar seu valor numérico", () => {
  assert.equal(formatDistanceModifier(0), "0");
  assert.equal(formatDistanceModifier(-6), "−6");
  assert.equal(formatDistanceModifier(2), "+2");
});
