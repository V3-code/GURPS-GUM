import test from "node:test";
import assert from "node:assert/strict";
import { resolveRollReference } from "../module/utils/roll-reference-resolver.mjs";

const attributes = { dx: { final: 14 }, iq: { final: 12 } };
const skill = (name, nh, specialization = "") => ({ id: `${name}-${specialization}`, type: "skill", name, system: { final_nh: nh, specialization } });

test("ignora perícia não possuída ao escolher o melhor valor", () => {
  assert.deepEqual(resolveRollReference("DX-5, Arco", attributes, []), { available: true, value: 9, label: "DX-5", sourceType: "attribute" });
});

test("usa perícia possuída quando ela é a melhor alternativa", () => {
  assert.equal(resolveRollReference("DX-5, Arco", attributes, [skill("Arco", 12)]).value, 12);
});

test("encontra nome e especialização nos campos separados da perícia", () => {
  const skills = [skill("Armas", 13, "Rifle"), skill("Armas", 15, "Pistola")];
  const result = resolveRollReference("armas ( pÍstola )", attributes, skills);
  assert.equal(result.value, 15);
  assert.equal(result.label, "Armas (Pistola)");
});

test("não aceita outra especialização e não inventa NH 10", () => {
  const result = resolveRollReference("Armas (Arco)", attributes, [skill("Armas", 15, "Pistola")]);
  assert.deepEqual(result, { available: false, value: null, label: "N/A", sourceType: "unavailable" });
});

test("preserva maior, menor, números fixos e modificadores", () => {
  assert.equal(resolveRollReference("maior(DX-5, IQ-1)", attributes).value, 11);
  assert.equal(resolveRollReference("menor(DX-5, IQ-1)", attributes).value, 9);
  assert.equal(resolveRollReference("12+2", attributes).value, 14);
});