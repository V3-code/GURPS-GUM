import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const prompt = fs.readFileSync(new URL("../module/apps/roll-prompt.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const engine = fs.readFileSync(new URL("../scripts/effects-engine.js", import.meta.url), "utf8");

test("prompt resolve modificadores condicionais antes de ignorar os globais", () => {
    assert.match(prompt, /import \{ resolveConditionalValue \} from "\.\.\/utils\/effect-value-expression\.mjs"/);
    assert.match(prompt, /value: this\._evaluateModifierEntryValue\(entry\)/);
    assert.match(prompt, /resolveConditionalValue\(rawValue, \{ actor, rollData: this\.rollData \}\)/);
    assert.match(prompt, /defer_value_evaluation[\s\S]*?value_mode !== "per_origin_level"/);
    assert.match(prompt, /ignoreGlobals: true/);
    assert.match(prompt, /evaluateModifierRollFormulaSync\(source, actor\?\.getRollData\?\.\(\) \|\| \{\}\)/);
    assert.match(main, /evaluateModifierRollFormulaSync\(source, actor\?\.getRollData\?\.\(\) \|\| \{\}\)/);
});

test("prompt avalia contramodificadores contra o ator que possui o efeito", () => {
    assert.match(prompt, /_evaluateModifierEntryValue\(candidate\.entry, \{ actor: candidate\.targetActor \}\)/);
    assert.match(prompt, /_isWorseForRoller\(payload\.value, current\.value\)/);
});

test("execução direta resolve candidatos condicionais antes de agrupá-los", () => {
    const collector = main.slice(
        main.indexOf("function _collectTargetCounterRollModifiers"),
        main.indexOf("async function applyActivationEffects")
    );
    assert.match(collector, /const value = _evaluateModifierEntryValue\(targetToken\.actor, candidate\.entry, rollData\)/);
    assert.match(collector, /Number\(value\) < Number\(current\.value\)/);
    assert.doesNotMatch(collector, /value = candidate\.entry\?\.value/);
});

test("override de dano básico resolve a condição sem rolar a fórmula selecionada", () => {
    assert.match(engine, /selectedFormula = resolveConditionalValue\(action\.value, \{ actor: targetActor \}\)/);
    assert.match(engine, /resolveBasicDamageOverride\(selectedFormula\)/);
});

test("alteração de recurso compartilha rolagens comuns e resolve condicionais por alvo", () => {
    assert.match(engine, /const targetDependentValue = hasConditionalValueExpression\(valueToChange\)/);
    assert.match(engine, /const sharedEvaluation = targetDependentValue[\s\S]*?await evaluateEffectValue\(valueToChange, targets\[0\]\?\.actor \?\? context\.actor\)/);
    assert.match(engine, /sharedEvaluation \?\? await evaluateEffectValue\(valueToChange, targetActor\)/);
});
