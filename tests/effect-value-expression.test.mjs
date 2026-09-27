import assert from "node:assert/strict";
import test from "node:test";

import {
    actorHasItem,
    hasConditionalValueExpression,
    resolveConditionalValue
} from "../module/utils/effect-value-expression.mjs";

const actor = {
    items: [
        { id: "trained", uuid: "Actor.hero.Item.trained", name: "Treinado por um Mestre" },
        { id: "reflexes", name: "Reflexos em Combate", flags: { core: { sourceId: "Compendium.gum.Item.reflexes" } } }
    ]
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

test("preserva a fórmula do ramo escolhido para o avaliador da fase", () => {
    assert.equal(resolveConditionalValue('se(possui("Treinado por um Mestre"), 1d6+2, 2d6)', { actor }), "1d6+2");
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
