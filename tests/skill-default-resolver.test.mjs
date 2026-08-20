import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSkillText, resolveSkillDefault } from "../module/utils/skill-default-resolver.mjs";

const actor = (items = []) => ({ system: { attributes: { dx: { final: 14 }, iq: { final: 12 }, vont: { final: 11 } } }, items });
const skill = (name, nh, specialization = "", predefined = {}) => ({ id: name, uuid: `Actor.a.Item.${name}`, type: "skill", name, system: { final_nh: nh, specialization, predefined } });

test("normaliza acentos, caixa e espaços", () => assert.equal(normalizeSkillText("  PerÍcia   MÉDICA "), "pericia medica"));
test("usa a perícia possuída e sua especialização", () => assert.equal(resolveSkillDefault(actor([skill("Armas", 15, "Pistola")]), { skillName: "ARMAS", specialization: "pistola" }).value, 15));
test("resolve atributo e escolhe o maior pré-definido", () => assert.deepEqual(resolveSkillDefault(actor(), { skillName: "Furtividade", predefined: { slot1: { name: "DX", modifier: -5 }, slot2: { name: "IQ", modifier: -2 } } }).value, 10));
test("resolve pré-definido de outra perícia possuída", () => assert.equal(resolveSkillDefault(actor([skill("Acrobacia", 13)]), { skillName: "Salto", predefined: { slot1: { name: "Acrobacia", modifier: -2 } } }).value, 11));
test("referência inválida e ausência não viram NH 10", () => assert.equal(resolveSkillDefault(actor(), { skillName: "X", predefined: { slot1: { name: "Desconhecida", modifier: 0 } } }).available, false));
test("perícia personalizada exige atributo válido", () => { assert.equal(resolveSkillDefault(actor(), { type: "customSkill", skillName: "X", customDefault: { attributeKey: "DX", modifier: -5 } }).value, 9); assert.equal(resolveSkillDefault(actor(), { type: "customSkill", skillName: "X", customDefault: { attributeKey: "???", modifier: -5 } }).available, false); });
test("ciclo recursivo é rejeitado", () => { const a = skill("A", NaN, "", { slot1: { name: "B", modifier: 0 } }); const b = skill("B", NaN, "", { slot1: { name: "A", modifier: 0 } }); assert.equal(resolveSkillDefault(actor([a, b]), { skillName: "C", predefined: { slot1: { name: "A", modifier: 0 } } }).available, false); });