import assert from "node:assert/strict";
import test from "node:test";

import {
  collectActiveEquipmentGrantedEffects,
  EQUIPMENT_GRANTED_EFFECT_SOURCE,
  hasEquipmentGrantRelevantChange,
  matchesEquipmentGrantedEffectScope
} from "../module/utils/equipment-granted-effects.mjs";

const resolution = grants => ({ grantedEffects: grants });
const grant = (lifecycle, domain = "wearer") => ({ id: `${domain}:${lifecycle}`, effectUuid: "Item.effect", lifecycle, domain });

test("collects wearer effects according to the equipment lifecycle", () => {
  const grants = [
    grant("while_possessed"), grant("while_carried"), grant("while_equipped"), grant("while_active"),
    grant("while_equipped", "hit_target")
  ];
  assert.deepEqual(collectActiveEquipmentGrantedEffects({ location: "stored" }, resolution(grants)).map(entry => entry.lifecycle), ["while_possessed"]);
  assert.deepEqual(collectActiveEquipmentGrantedEffects({ location: "carried" }, resolution(grants)).map(entry => entry.lifecycle), ["while_possessed", "while_carried"]);
  assert.deepEqual(collectActiveEquipmentGrantedEffects({ location: "equipped" }, resolution(grants)).map(entry => entry.lifecycle), ["while_possessed", "while_carried", "while_equipped"]);
  assert.deepEqual(collectActiveEquipmentGrantedEffects({ location: "stored", active: true }, resolution(grants)).map(entry => entry.lifecycle), ["while_possessed", "while_active"]);
});

test("detects only changes that can alter granted effects", () => {
  assert.equal(hasEquipmentGrantRelevantChange({ "system.eqp_modifiers.a.features_data.b.value": 2 }), true);
  assert.equal(hasEquipmentGrantRelevantChange({ "system.location": "equipped" }), true);
  assert.equal(hasEquipmentGrantRelevantChange({ system: { active: true } }), true);
  assert.equal(hasEquipmentGrantRelevantChange({ name: "Novo nome" }), false);
});

test("uses a dedicated ActiveEffect source marker", () => {
  assert.equal(EQUIPMENT_GRANTED_EFFECT_SOURCE, "equipmentModifierFeature");
});

test("limits source-attack effects to their host item and attack selector", () => {
  const effect = { flags: { gum: { equipmentGrant: {
    domain: "source_attack", originItemId: "shield", attackType: "melee", selectorField: "group", selectorValue: "golpe-com-escudo"
  } } } };
  assert.equal(matchesEquipmentGrantedEffectScope(effect, { id: "shield" }, { groups: "escudo, golpe-com-escudo" }, "melee"), true);
  assert.equal(matchesEquipmentGrantedEffectScope(effect, { id: "sword" }, { groups: "golpe-com-escudo" }, "melee"), false);
  assert.equal(matchesEquipmentGrantedEffectScope(effect, { id: "shield" }, { groups: "golpe-com-escudo" }, "ranged"), false);
  assert.equal(matchesEquipmentGrantedEffectScope(effect, { id: "shield" }, { groups: "outro" }, "melee"), false);
  assert.equal(matchesEquipmentGrantedEffectScope({}, null, null, ""), true);
});
