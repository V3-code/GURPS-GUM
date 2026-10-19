import test from "node:test";
import assert from "node:assert/strict";
import { REQUESTED_ATTRIBUTE_OPTIONS, normalizeRequestedAttributeKey, resolveRequestedAttribute } from "../module/utils/requested-attributes.mjs";
import { normalizeRollTest } from "../module/utils/roll-request-data.mjs";

test("oferece sentidos e esquiva entre os atributos solicitáveis", () => {
  const labelsByKey = Object.fromEntries(REQUESTED_ATTRIBUTE_OPTIONS.map(({ key, label }) => [key, label]));
  assert.deepEqual(
    Object.fromEntries(["vision", "hearing", "tastesmell", "touch", "dodge"].map(key => [key, labelsByKey[key]])),
    { vision: "Visão", hearing: "Audição", tastesmell: "Paladar/Olfato", touch: "Tato", dodge: "Esquiva" }
  );
});

test("resolve sentidos com contexto sensorial e esquiva com contexto de defesa", () => {
  const attributes = { vision: { final: 13 }, dodge: { value: 9 } };
  assert.deepEqual(resolveRequestedAttribute(attributes, "vision"), {
    available: true, value: 13, label: "Visão", type: "skill", attributeKey: "vision"
  });
  assert.deepEqual(resolveRequestedAttribute(attributes, "dodge"), {
    available: true, value: 9, label: "Esquiva", type: "defense", attributeKey: "dodge", defenseType: "dodge", defenseBonusIncluded: false
  });
  assert.equal(resolveRequestedAttribute({ dodge: { final: 11, value: 9 } }, "dodge").defenseBonusIncluded, true);
});

test("normalização reconhece sentidos e esquiva como atributos em formatos legados", () => {
  for (const attribute of ["vision", "hearing", "tastesmell", "touch", "dodge"]) {
    assert.equal(normalizeRollTest({ attribute }).type, "attribute");
  }
});

test("normaliza aliases de atributos em português e inglês para as chaves internas", () => {
  assert.equal(normalizeRequestedAttributeKey("WILL"), "vont");
  assert.equal(normalizeRequestedAttributeKey("Willpower"), "vont");
  assert.equal(normalizeRequestedAttributeKey("Perception"), "per");
  assert.equal(normalizeRequestedAttributeKey("Strength"), "st");
  assert.equal(normalizeRequestedAttributeKey("Visão"), "vision");
  assert.equal(normalizeRequestedAttributeKey("Taste/Smell"), "tastesmell");
});

test("resolve aliases ingleses usando os atributos internos da ficha", () => {
  const attributes = { vont: { final: 12 }, per: { final: 13 }, st: { value: 11 } };
  assert.deepEqual(resolveRequestedAttribute(attributes, "will"), {
    available: true, value: 12, label: "Vont", type: "attribute", attributeKey: "vont"
  });
  assert.equal(resolveRequestedAttribute(attributes, "perception").value, 13);
  assert.equal(resolveRequestedAttribute(attributes, "strength").value, 11);
});
