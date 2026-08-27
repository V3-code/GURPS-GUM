import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSecondaryStatsRecalculationPlan,
  buildSecondaryStatsUpdateData,
  formatBasicDamageDiceCount,
  getPreparedPrimaryAttributeValue,
  secondaryStatValuesEqual
} from "../module/utils/secondary-stats-recalculation.mjs";

const attribute = (value, extra = {}) => ({ value, mod: 0, passive: 0, temp: 0, final: value, override: null, ...extra });
const fixture = () => ({
  attributes: {
    st: attribute(12), dx: attribute(11), ht: attribute(10), per: attribute(13),
    hp: { ...attribute(9), max: 10 }, fp: { ...attribute(8), max: 9 },
    lifting_st: attribute(8), basic_speed: attribute(4, { mod: .25, final: 4.25 }),
    basic_move: attribute(4), dodge: attribute(7, { gcs_imported_fixed: 7 }),
    vision: attribute(10), hearing: attribute(10), tastesmell: attribute(10), touch: attribute(10),
    thrust_damage: "1d6", swing_damage: "1d6"
  }
});
const damage = st => st > 30 ? { thrust: "30d", swing: "60d" } : { thrust: "1d6-1", swing: "1d6+2" };

test("construir e cancelar a prévia não modifica ator, itens ou efeitos", () => {
  const system = fixture();
  const items = [{ id: "item" }];
  const effects = [{ id: "effect" }];
  const before = structuredClone({ system, items, effects });
  buildSecondaryStatsRecalculationPlan(system, damage);
  assert.deepEqual({ system, items, effects }, before);
  assert.deepEqual(buildSecondaryStatsUpdateData([], []), {});
});

test("confirmação vazia e valores iguais não produzem update", () => {
  const system = fixture();
  system.attributes.hp.max = 12;
  const plan = buildSecondaryStatsRecalculationPlan(system, damage);
  assert.deepEqual(buildSecondaryStatsUpdateData(plan, []), {});
  assert.equal(buildSecondaryStatsUpdateData(plan, ["hp-max"])["system.attributes.hp.max"], undefined);
  assert.equal(secondaryStatValuesEqual(5.5001, 5.5, 2), true);
});

test("somente paths selecionados são aplicados e recursos atuais são preservados", () => {
  const plan = buildSecondaryStatsRecalculationPlan(fixture(), damage);
  const update = buildSecondaryStatsUpdateData(plan, ["hp-max", "fp-max", "vision"]);
  assert.deepEqual(update, {
    "system.attributes.hp.max": 12,
    "system.attributes.fp.max": 10,
    "system.attributes.vision.value": 13
  });
  assert.equal("system.attributes.hp.value" in update, false);
  assert.equal("system.attributes.fp.value" in update, false);
});

test("Esquiva fixa importada só é removida junto com Esquiva", () => {
  const plan = buildSecondaryStatsRecalculationPlan(fixture(), damage);
  assert.equal(buildSecondaryStatsUpdateData(plan, ["basic-speed"])["system.attributes.dodge.-=gcs_imported_fixed"], undefined);
  assert.equal(buildSecondaryStatsUpdateData(plan, ["dodge"])["system.attributes.dodge.-=gcs_imported_fixed"], null);
});

test("override protege o campo e não remove a Esquiva fixa", () => {
  const system = fixture();
  system.attributes.dodge.override = 12;
  const plan = buildSecondaryStatsRecalculationPlan(system, damage);
  const dodge = plan.find(entry => entry.id === "dodge");
  assert.equal(dodge.protectedByOverride, true);
  assert.deepEqual(buildSecondaryStatsUpdateData(plan, ["dodge"]), {});
});

test("bases não incorporam modificadores e movimento usa a velocidade proposta", () => {
  const system = fixture();
  system.attributes.vision.mod = 2;
  const plan = buildSecondaryStatsRecalculationPlan(system, damage);
  assert.equal(plan.find(entry => entry.id === "vision").proposedValue, 13);
  assert.equal(plan.find(entry => entry.id === "vision").proposedFinal, 15);
  assert.equal(plan.find(entry => entry.id === "basic-move").proposedValue, 5);
  assert.equal(plan.find(entry => entry.id === "dodge").proposedValue, 8);
});

test("dano usa a função canônica injetada inclusive para ST extrema", () => {
  const system = fixture();
  system.attributes.st.value = 300;
  system.attributes.st.final = 300;
  system.attributes.thrust_damage = "1d6";
  const calls = [];
  const plan = buildSecondaryStatsRecalculationPlan(system, st => { calls.push(st); return damage(st); });
  assert.deepEqual(calls, [300]);
  assert.equal(plan.find(entry => entry.id === "thrust-damage").proposedValue, "30d");
  assert.equal(plan.find(entry => entry.id === "thrust-damage").changed, true);
});

test("atributos derivados usam finais preparados, incluindo passivos e overrides primários", () => {
  const system = fixture();
  system.attributes.st = attribute(12, { passive: 3, final_computed: 15, final: 15 });
  system.attributes.dx = attribute(11, { temp: 1, final_computed: 12, final: 12 });
  system.attributes.ht = attribute(10, { mod: 2, final_computed: 12, final: 12 });
  system.attributes.per = attribute(13, { override: 17, final_computed: 13, final: 17 });
  const calls = [];
  const plan = buildSecondaryStatsRecalculationPlan(system, st => {
    calls.push(st);
    return { thrust: "1d6+1", swing: "2d6+1" };
  });

  assert.deepEqual(calls, [15]);
  assert.equal(plan.find(entry => entry.id === "hp-max").proposedValue, 15);
  assert.equal(plan.find(entry => entry.id === "lifting-st").proposedValue, 15);
  assert.equal(plan.find(entry => entry.id === "basic-speed").proposedValue, 6);
  assert.equal(plan.find(entry => entry.id === "vision").proposedValue, 17);
  assert.match(plan.find(entry => entry.id === "thrust-damage").reason, /ST final 15.*adicionais \+3/);
});

test("resolução do valor primário preparado possui fallbacks sem confundir zero", () => {
  assert.equal(getPreparedPrimaryAttributeValue({ value: 10, final_computed: 12, final: 0 }), 0);
  assert.equal(getPreparedPrimaryAttributeValue({ value: 10, final_computed: 12 }), 12);
  assert.equal(getPreparedPrimaryAttributeValue({ value: 10 }), 10);
});

test("dano com muitos dados preserva explicitamente as faces d6", () => {
  assert.equal(formatBasicDamageDiceCount(3), "3d6");
  assert.equal(formatBasicDamageDiceCount(30), "30d6");
  assert.equal(formatBasicDamageDiceCount(59), "59d6");
});

test("apresentação aceita localização injetada sem alterar paths ou cálculos", () => {
  const calls = [];
  const i18n = {
    localize: key => {
      calls.push(["localize", key]);
      return `loc:${key}`;
    },
    format: (key, data) => {
      calls.push(["format", key, data]);
      return `fmt:${key}`;
    }
  };
  const plan = buildSecondaryStatsRecalculationPlan(fixture(), damage, i18n);
  const hp = plan.find(entry => entry.id === "hp-max");
  const dodge = plan.find(entry => entry.id === "dodge");

  assert.equal(hp.label, "loc:GUM.SecondaryStatsRecalculation.Entries.HPMax");
  assert.equal(hp.reason, "fmt:GUM.SecondaryStatsRecalculation.Reasons.CalculatedFrom");
  assert.equal(hp.path, "system.attributes.hp.max");
  assert.equal(hp.proposedValue, 12);
  assert.equal(dodge.warnings[0], "loc:GUM.SecondaryStatsRecalculation.Warnings.RemoveImportedDodge");
  assert.ok(calls.some(([, key]) => key === "GUM.SecondaryStatsRecalculation.PrimaryFinal"));
  assert.deepEqual(buildSecondaryStatsUpdateData(plan, ["hp-max"]), { "system.attributes.hp.max": 12 });
});