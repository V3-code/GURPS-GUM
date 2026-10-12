import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateJavaScriptNumericExpression,
  resolveConditionalValue
} from "../module/utils/effect-value-expression.mjs";

const actor = {
  items: [{ id: "reflexes", name: "Reflexos em Combate" }],
  system: { attributes: { dx: { final: 13 }, ht: { final: 11 } } }
};

test("evaluates GM modifier JavaScript with the same actor, game, and roll context", () => {
  const game = { combat: { round: 3 } };
  const rollData = { modifier: -2 };
  assert.equal(evaluateJavaScriptNumericExpression("Math.floor(actor.system.attributes.dx.final / 2)", { actor }), 6);
  assert.equal(evaluateJavaScriptNumericExpression("game.combat.round + rollData.modifier", { actor, game, rollData }), 1);
  assert.equal(evaluateJavaScriptNumericExpression("actor.missing.value", { actor }), null);
});

test("conditional GM modifier branches can contain JavaScript expressions", () => {
  const expression = 'se(possui("Reflexos em Combate"), Math.max(actor.system.attributes.ht.final - 10, 1), -4)';
  const selected = resolveConditionalValue(expression, { actor });
  assert.equal(selected, "Math.max(actor.system.attributes.ht.final - 10, 1)");
  assert.equal(evaluateJavaScriptNumericExpression(selected, { actor }), 1);
});

test("the GM modifier editor preserves expressions instead of coercing them to numbers", async () => {
  const [template, sheet, schema, styles] = await Promise.all([
    readFile(new URL("../templates/items/item-sheet.hbs", import.meta.url), "utf8"),
    readFile(new URL("../module/item/gurps-item-sheet.js", import.meta.url), "utf8"),
    readFile(new URL("../template.json", import.meta.url), "utf8"),
    readFile(new URL("../styles/item-sheet.css", import.meta.url), "utf8")
  ]);
  const data = JSON.parse(schema);
  assert.equal(data.Item.gm_modifier.modifier, "0");
  assert.match(template, /gm-modifier-expression-input/);
  assert.match(template, /<textarea[^>]+name="system\.modifier_entries\.\{\{entry\.index\}\}\.value"/);
  assert.doesNotMatch(template, /type="number"[^>]+name="system\.modifier_entries\.\{\{entry\.index\}\}\.value"/);
  assert.match(sheet, /value: \(entry\.value \?\? ""\)\.toString\(\)\.trim\(\) \|\| "0"/);
  assert.match(styles, /\.gm-modifier-expression-input/);
});

test("roll and GM Screen flows retain and evaluate GM modifier expressions", async () => {
  const [prompt, main, gmScreen, gmScreenTemplate, actorTemplate] = await Promise.all([
    readFile(new URL("../module/apps/roll-prompt.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/main.js", import.meta.url), "utf8"),
    readFile(new URL("../module/apps/gm-screen.js", import.meta.url), "utf8"),
    readFile(new URL("../templates/apps/gm-screen.hbs", import.meta.url), "utf8"),
    readFile(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8")
  ]);
  assert.match(prompt, /resolveConditionalValue\(rawValue, \{ actor, rollData: this\.rollData \}\)/);
  assert.match(prompt, /evaluateJavaScriptNumericExpression\(source/);
  assert.match(prompt, /value: this\._evaluateModifierValue\(entry\?\.value\)/);
  assert.match(main, /evaluateJavaScriptNumericExpression\(source, \{ actor, game, rollData \}\)/);
  assert.match(gmScreen, /value: String\(entry\?\.value \?\? ""\)\.trim\(\) \|\| "0"/);
  assert.match(gmScreenTemplate, /modifierCompactDisplay/);
  assert.match(actorTemplate, /modifierCompactDisplay/);
});

test("new GM modifier copy is localized in Portuguese and English", async () => {
  const [pt, en] = await Promise.all([
    readFile(new URL("../lang/pt-BR.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../lang/en.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  for (const key of ["GUM.GMModifier.ValueExpression", "GUM.GMModifier.ValueHint", "GUM.GMModifier.ValuePlaceholder"]) {
    assert.ok(pt[key]);
    assert.ok(en[key]);
  }
});
