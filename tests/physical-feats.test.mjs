import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateLiftingCapacities,
  calculateJumpBases,
  prepareBasicLiftAttribute,
  preparePhysicalFeatAttributes,
  resolveThrowingDistance
} from "../module/utils/physical-feats.mjs";

const attribute = (overrides = {}) => ({
  value: 0,
  mod: 0,
  temp: 0,
  passive: 0,
  points: 0,
  override: null,
  final: 0,
  final_computed: 0,
  ...overrides
});

test("calcula os saltos horizontal e vertical a partir do Deslocamento final", () => {
  assert.deepEqual(calculateJumpBases(5), {
    jump_horizontal_standing: 2.13,
    jump_horizontal_running: 4.27,
    jump_vertical_standing: 0.51,
    jump_vertical_running: 1.02
  });
});

test("saltos automáticos recebem camadas de modificador e respeitam override", () => {
  const attributes = {
    jump_horizontal_standing: attribute({ automatic: true, mod: 0.5, passive: 0.25, temp: -0.1 }),
    jump_horizontal_running: attribute({ automatic: true }),
    jump_vertical_standing: attribute({ automatic: true, override: 3 }),
    jump_vertical_running: attribute({ automatic: true })
  };
  preparePhysicalFeatAttributes(attributes, { basicMove: 5, liftingStrength: 10 });
  assert.equal(attributes.jump_horizontal_standing.final_computed, 2.78);
  assert.equal(attributes.jump_vertical_standing.final, 3);
});

test("salto manual conserva sua base editada", () => {
  const attributes = {
    jump_horizontal_standing: attribute({ automatic: false, value: 6, temp: 1 })
  };
  preparePhysicalFeatAttributes(attributes, { basicMove: 5, liftingStrength: 10 });
  assert.equal(attributes.jump_horizontal_standing.calculated_base, 2.13);
  assert.equal(attributes.jump_horizontal_standing.final, 7);
});

test("Carga Básica pode ser automática, manual ou sobrescrita", () => {
  const automatic = { basic_lift: attribute({ automatic: true, passive: 2 }) };
  assert.equal(prepareBasicLiftAttribute(automatic, { liftingStrength: 10 }).final, 12);

  const manual = { basic_lift: attribute({ automatic: false, value: 18, temp: -1 }) };
  assert.equal(prepareBasicLiftAttribute(manual, { liftingStrength: 10 }).final, 17);

  manual.basic_lift.override = 25;
  assert.equal(prepareBasicLiftAttribute(manual, { liftingStrength: 10 }).final, 25);
});

test("calcula as capacidades padrão a partir da Carga Básica efetiva", () => {
  assert.deepEqual(calculateLiftingCapacities(10), {
    basicLiftKg: 10,
    oneHandedKg: 20,
    twoHandedKg: 80,
    extraHeavyKg: 100,
    shoveKg: 120,
    carryOnBackKg: 150,
    runningShoveKg: 240,
    shiftSlightlyKg: 500
  });
});

test("calculadora de arremesso usa BL efetivo e ST para o alcance", () => {
  const result = resolveThrowingDistance({
    liftingStrength: 10,
    strikingStrength: 10,
    basicLiftKg: 10,
    objectWeightKg: 1
  });
  assert.equal(result.throwable, true);
  assert.equal(result.ratio, 0.1);
  assert.equal(result.hands, "one");
  assert.equal(result.distanceMeters, 22.86);
  assert.equal(result.maximumWeightKg, 80);
});

test("calculadora recusa objetos acima de oito vezes BL", () => {
  const result = resolveThrowingDistance({ basicLiftKg: 10, strikingStrength: 10, objectWeightKg: 81 });
  assert.equal(result.valid, true);
  assert.equal(result.throwable, false);
  assert.equal(result.hands, "none");
  assert.equal(result.distanceMeters, 0);
});

test("ficha, editor, efeitos e resumo de pontos expõem as proezas físicas", () => {
  const sheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
  const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
  const paths = readFileSync(new URL("../module/apps/effect-path-picker.mjs", import.meta.url), "utf8");
  for (const key of ["air_move", "water_move", "burrow_move", "jump_horizontal_standing", "jump_vertical_running", "basic_lift"]) {
    assert.match(sheet, new RegExp(`physicalStatRow\\('${key}'`));
    assert.match(sheet, new RegExp(`"${key}"`));
    assert.match(paths, new RegExp(`\\["${key}"`));
  }
  assert.match(template, /class="[^"]*physical-feats-block[^"]*"/);
  assert.match(template, /class="[^"]*physical-throw-calculator[^"]*"/);
  assert.match(template, /class="[^"]*physical-lifting-reference[^"]*"/);
  assert.match(sheet, /physical-attribute-heading[\s\S]*physical-auto-control[\s\S]*physical-base-control/);
});
