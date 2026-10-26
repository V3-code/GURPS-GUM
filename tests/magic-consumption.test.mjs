import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMagicConsumptionDeductions,
  buildMagicConsumptionDeductions,
  collectMagicConsumptionSources,
  normalizeMagicConsumptionGroups,
  resolveMagicConsumptionOptions,
  validateMagicConsumptionChoices
} from "../module/utils/magic-consumption.mjs";

function actorFixture() {
  const actorUpdates = [];
  const itemUpdates = [];
  const actor = {
    system: {
      attributes: { hp: { value: 5 }, fp: { value: 8 } },
      spell_reserves: { mana: { name: "Mana Élfica", current: 5, value: 5, max: 10 } },
      power_reserves: {},
      combat: { combat_meters: { focus: { name: "Foco", current: 4, value: 4, max: 6 } } }
    },
    items: [
      { id: "dust", name: "Pó Mágico", type: "equipment", system: { quantity: 3 }, _source: { system: { quantity: 3 } } },
      { id: "staff", name: "Cajado", type: "equipment", system: { quantity: 1, uses_mode: "charges", max_uses: 6, current_uses: 2, charge_reserve_type: "spell", charge_reserve_name: "Mana do Cajado", charge_reserve_scope: "any", location: "carried" }, _source: { system: { quantity: 1, uses_mode: "charges", max_uses: 6, current_uses: 2, charge_reserve_type: "spell", charge_reserve_name: "Mana do Cajado", charge_reserve_scope: "any", location: "carried" } } },
      { id: "shield", name: "Escudo", type: "equipment", system: { quantity: 1, item_hp: 12, item_hp_current: 8, item_dr: 3, integrity_record_enabled: true }, _source: { system: { quantity: 1, item_hp: 12, item_hp_current: 8, item_dr: 3, integrity_record_enabled: true } } },
      { id: "token", name: "Ficha Ritual", type: "money_source", system: { quantity: 2 }, _source: { system: { quantity: 2 } } }
    ],
    async update(data) { actorUpdates.push(data); },
    async updateEmbeddedDocuments(type, data) { itemUpdates.push({ type, data }); }
  };
  return { actor, actorUpdates, itemUpdates };
}

test("normalizes independent costs with alternative sources", () => {
  const groups = normalizeMagicConsumptionGroups({ cost: {
    name: "Energia", trigger: "success", amount: "2", variableAmount: true,
    sources: { fp: { type: "fp" }, mana: { type: "spell_reserve", name: "Mana" } }
  } });
  assert.equal(groups[0].trigger, "success");
  assert.equal(groups[0].variableAmount, true);
  assert.deepEqual(groups[0].sources.map(source => source.type), ["fp", "spell_reserve"]);
});

test("collects HP, FP, native records, item quantities, equipment reserves, and integrity records", () => {
  const { actor } = actorFixture();
  const sources = collectMagicConsumptionSources(actor);
  assert.deepEqual(sources.map(source => source.key), [
    "hp", "fp", "spell_reserve:mana", "combat_tracker:focus",
    "item_quantity:dust", "item_quantity:staff", "item_quantity:shield", "item_quantity:token",
    "equipment_reserve:staff:spell_reserve", "equipment_integrity:shield"
  ]);
  assert.equal(sources.find(source => source.key === "equipment_reserve:staff:spell_reserve").current, 4);
  assert.equal(sources.find(source => source.key === "equipment_integrity:shield").current, 8);
});

test("resolves names without case or accent differences and preserves ambiguous choices", () => {
  const { actor } = actorFixture();
  const sources = collectMagicConsumptionSources(actor);
  assert.equal(resolveMagicConsumptionOptions({ sources: [{ type: "spell_reserve", name: "mana elfica" }] }, sources)[0].key, "spell_reserve:mana");
  const ambiguous = [...sources, { ...sources.find(source => source.key === "spell_reserve:mana"), key: "spell_reserve:other" }];
  assert.deepEqual(
    resolveMagicConsumptionOptions({ sources: [{ type: "spell_reserve", name: "Mana Élfica" }] }, ambiguous).map(source => source.key),
    ["spell_reserve:mana", "spell_reserve:other"]
  );
  assert.deepEqual(
    resolveMagicConsumptionOptions({ sources: [{ type: "spell_reserve", name: "Mana Élfica", sourceKey: "spell_reserve:other" }] }, ambiguous).map(source => source.key),
    ["spell_reserve:other"]
  );
  assert.equal(resolveMagicConsumptionOptions({ sources: [{ type: "spell_reserve", name: "Mana Élfica", sourceKey: "stale" }] }, sources)[0].key, "spell_reserve:mana");
});

test("validates attempt plus each possible outcome without preventing negative HP or FP", () => {
  const { actor } = actorFixture();
  const sources = collectMagicConsumptionSources(actor);
  const groups = normalizeMagicConsumptionGroups({
    attempt: { trigger: "attempt", amount: 3, sources: { mana: { type: "spell_reserve", name: "Mana Élfica" } } },
    success: { trigger: "success", amount: 3, sources: { mana: { type: "spell_reserve", name: "Mana Élfica" } } },
    failure: { trigger: "failure", amount: 20, sources: { fp: { type: "fp" } } }
  });
  const choices = {
    attempt: { sourceKey: "spell_reserve:mana", amount: 3 },
    success: { sourceKey: "spell_reserve:mana", amount: 3 },
    failure: { sourceKey: "fp", amount: 20 }
  };
  const validation = validateMagicConsumptionChoices(groups, sources, choices);
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors.filter(error => error.code === "insufficient").map(error => error.outcome), ["success"]);
});

test("builds only the deductions for the selected trigger", () => {
  const groups = normalizeMagicConsumptionGroups({
    first: { trigger: "attempt", sources: { fp: { type: "fp" } } },
    second: { trigger: "success", sources: { fp: { type: "fp" } } }
  });
  const choices = { first: { sourceKey: "fp", amount: 1 }, second: { sourceKey: "fp", amount: 2 } };
  assert.deepEqual(buildMagicConsumptionDeductions(groups, choices, "attempt"), [{ sourceKey: "fp", amount: 1 }]);
  assert.deepEqual(buildMagicConsumptionDeductions(groups, choices, "success"), [{ sourceKey: "fp", amount: 2 }]);
});

test("applies actor and embedded-item deductions while allowing negative HP", async () => {
  const { actor, actorUpdates, itemUpdates } = actorFixture();
  const result = await applyMagicConsumptionDeductions(actor, [
    { sourceKey: "hp", amount: 7 },
    { sourceKey: "item_quantity:dust", amount: 2 }
  ]);
  assert.deepEqual(actorUpdates, [{ "system.attributes.hp.value": -2 }]);
  assert.deepEqual(itemUpdates, [{ type: "Item", data: [{ _id: "dust", "system.quantity": 1 }] }]);
  assert.deepEqual(result.consumed.map(entry => entry.after), [-2, 1]);
});

test("consumes an equipment-backed reserve through its persisted charge balance", async () => {
  const { actor, itemUpdates } = actorFixture();
  await applyMagicConsumptionDeductions(actor, [
    { sourceKey: "equipment_reserve:staff:spell_reserve", amount: 3 }
  ]);
  assert.deepEqual(itemUpdates, [{ type: "Item", data: [{ _id: "staff", "system.current_uses": 5 }] }]);
});

test("consumes equipment integrity without changing charges or quantity", async () => {
  const { actor, itemUpdates } = actorFixture();
  await applyMagicConsumptionDeductions(actor, [
    { sourceKey: "equipment_integrity:shield", amount: 3 }
  ]);
  assert.deepEqual(itemUpdates, [{ type: "Item", data: [{ _id: "shield", "system.item_hp_current": 5 }] }]);
});

test("rejects an integrity cost above the equipment's current integrity", () => {
  const { actor } = actorFixture();
  const sources = collectMagicConsumptionSources(actor);
  const groups = normalizeMagicConsumptionGroups({
    cost: { trigger: "attempt", amount: 9, sources: { shield: { type: "combat_tracker", name: "Escudo" } } }
  });
  const validation = validateMagicConsumptionChoices(groups, sources, {
    cost: { sourceKey: "equipment_integrity:shield", amount: 9 }
  });
  assert.equal(validation.valid, false);
  assert.equal(validation.errors[0].code, "insufficient");
});
