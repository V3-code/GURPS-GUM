import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const template = fs.readFileSync(new URL("../templates/items/effect-sheet.hbs", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles/item-sheet.css", import.meta.url), "utf8");

test("teste da mensagem de chat reserva uma linha para a expressão", () => {
  assert.match(template, /effect-chat-roll-value-field/);
  assert.match(template, /effect-code-input effect-chat-roll-value-input/);
  assert.match(template, /class="effect-field-help"[\s\S]*?role="tooltip"/);
  assert.doesNotMatch(template, /<small>Aceita número ou expressão JavaScript avaliada para o alvo\.<\/small>/);
  assert.match(styles, /\.effect-chat-roll-value-field \{[\s\S]*?grid-column: 1 \/ -1;/);
});

test("contexto do teste apresenta resumo e ação compacta", () => {
  const purposeControl = template.slice(template.indexOf("effect-chat-purpose-control"), template.indexOf("{{! ============================================= }}", template.indexOf("effect-chat-purpose-control")));
  assert.ok(purposeControl.indexOf("effect-purpose-summary") < purposeControl.indexOf("open-purpose-picker"));
  assert.match(styles, /\.effect-chat-purpose-control \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.roll-tag-picker-option\.is-selected \.gum-purpose-picker-check/);
});
