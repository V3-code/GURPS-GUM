import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
    actorHasItem,
    hasConditionalValueExpression,
    resolveConditionalValue
} from "../module/utils/effect-value-expression.mjs";

const actor = {
    items: [
        { id: "trained", uuid: "Actor.hero.Item.trained", name: "Treinado por um Mestre", system: { level: 2 } },
        { id: "reflexes", name: "Reflexos em Combate", flags: { core: { sourceId: "Compendium.gum.Item.reflexes" } } },
        { id: "arrows", name: "Flecha", type: "equipment", system: { quantity: 12, equipped: false, location: "carried" } },
        { id: "spare-sword", name: "Espada", type: "equipment", system: { quantity: 1, equipped: false, location: "carried" } },
        { id: "sword", name: "Espada", type: "equipment", system: { quantity: 1, equipped: true, location: "equipped" } },
        { id: "focused", name: "Concentrado", type: "condition", flags: { gum: { wasActive: true, manual_override: false } } }
    ],
    effects: [],
    appliedEffects: [
        { name: "Atordoado", statuses: new Set(["stunned"]), disabled: false },
        { name: "Transferido", statuses: new Set(["blessed"]), disabled: false }
    ],
    system: { attributes: { dx: { final: 14 } } }
};

test("reconhece item por nome sem diferenciar caixa ou acentos", () => {
    assert.equal(actorHasItem(actor, "treinado por um mestre"), true);
    assert.equal(actorHasItem(actor, "REFLEXOS EM COMBATE"), true);
});

test("reconhece referências estáveis por id, uuid e sourceId", () => {
    assert.equal(actorHasItem(actor, "trained"), true);
    assert.equal(actorHasItem(actor, "Actor.hero.Item.trained"), true);
    assert.equal(actorHasItem(actor, "Compendium.gum.Item.reflexes"), true);
});

test("se() escolhe o valor conforme a existência do item", () => {
    assert.equal(resolveConditionalValue('se(possui("Treinado por um Mestre"), -2, -4)', { actor }), "-2");
    assert.equal(resolveConditionalValue('se(possui("Mestre de Armas"), -2, -4)', { actor }), "-4");
});

test("todos(), algum() e nao() compõem condições", () => {
    assert.equal(resolveConditionalValue('se(todos(possui("Treinado por um Mestre"), possui("Reflexos em Combate")), -1, -4)', { actor }), "-1");
    assert.equal(resolveConditionalValue('se(algum(possui("Inexistente"), possui("Reflexos em Combate")), -2, -4)', { actor }), "-2");
    assert.equal(resolveConditionalValue('se(nao(possui("Inexistente")), 3, 0)', { actor }), "3");
});

test("atalhos de presença e ausência aceitam listas de itens", () => {
    assert.equal(resolveConditionalValue('se(naopossui("Mestre de Armas"), 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(nãopossui("Treinado por um Mestre"), 1, 0)', { actor }), "0");
    assert.equal(resolveConditionalValue('se(possuiAlgum("Inexistente", "Reflexos em Combate"), 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(possuiTodos("Treinado por um Mestre", "Reflexos em Combate"), 1, 0)', { actor }), "1");
});

test("consulta nível, quantidade e atributo com comparações seguras", () => {
    assert.equal(resolveConditionalValue('se(nivel("Treinado por um Mestre") >= 2, 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(quantidade("Flecha") > 10, 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(atributo("DX") == 14, 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(atributo("DX") = 14, 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(quantidade("Inexistente") != 0, 1, 0)', { actor }), "0");
});

test("consulta equipamento, condição ativa e status", () => {
    assert.equal(resolveConditionalValue('se(equipado("Espada"), 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(equipado("Flecha"), 1, 0)', { actor }), "0");
    assert.equal(resolveConditionalValue('se(condicaoAtiva("Concentrado"), 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(status("stunned"), 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(status("Atordoado"), 1, 0)', { actor }), "1");
    assert.equal(resolveConditionalValue('se(status("blessed"), 1, 0)', { actor }), "1");
});

test("preserva a fórmula do ramo escolhido para o avaliador da fase", () => {
    assert.equal(resolveConditionalValue('se(possui("Treinado por um Mestre"), 1d6+2, 2d6)', { actor }), "1d6+2");
});

test("preserva vírgulas internas em termos de rolagem agrupados", () => {
    assert.equal(
        resolveConditionalValue('se(possui("Treinado por um Mestre"), {1d6,2d6}kh, {1d6,2d6}kl)', { actor }),
        "{1d6,2d6}kh"
    );
    assert.equal(
        resolveConditionalValue('se(possui("Inexistente"), [1,2], maior(3, 4))', { actor }),
        "maior(3, 4)"
    );
});

test("aceita condicionais aninhadas", () => {
    const expression = 'se(possui("Inexistente"), 0, se(possui("Reflexos em Combate"), maior(DX, 12), 1))';
    assert.equal(resolveConditionalValue(expression, { actor }), "maior(DX, 12)");
});

test("não interfere em valores legados sem se()", () => {
    assert.equal(hasConditionalValueExpression("maior(DX, 12)"), false);
    assert.equal(resolveConditionalValue("maior(DX, 12)", { actor }), "maior(DX, 12)");
    assert.equal(resolveConditionalValue(-4, { actor }), -4);
});

test("rejeita estruturas condicionais inválidas", () => {
    assert.throws(() => resolveConditionalValue('se(possui("Item"), 1)', { actor }), /requer condição/);
    assert.throws(() => resolveConditionalValue('se(desconhecida("Item"), 1, 0)', { actor }), /não reconhecida/);
});

test("manual documenta a linguagem pública e está vinculado no README", () => {
    const manual = fs.readFileSync(new URL("../docs/effect-value-expressions.md", import.meta.url), "utf8");
    const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
    for (const expression of ["possui", "naopossui", "possuiAlgum", "possuiTodos", "nivel", "quantidade", "equipado", "condicaoAtiva", "status", "atributo", "todos", "algum", "nao"]) {
        assert.match(manual, new RegExp(`\\b${expression}\\b`));
    }
    assert.match(manual, /Momento da avaliação/);
    assert.match(readme, /docs\/effect-value-expressions\.md/);
});
