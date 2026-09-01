import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/apps/damage-application.hbs", import.meta.url), "utf8");
const source = readFileSync(new URL("../scripts/apps/damage-application.js", import.meta.url), "utf8");

test("damage nature is editable beside the wounding modifier", () => {
  const calculator = template.slice(template.indexOf('<div class="footer-column calculation-summary">'));

  assert.match(calculator, /damage-nature-group[\s\S]+data-field="wounding_mod"[\s\S]+name="damage_nature"/);
  assert.match(calculator, /name="damage_nature" class="calc-input-compact"/);
  assert.doesNotMatch(calculator, /name="damage_type"/);
  assert.match(source, /natureInput\.value = formatDamageNature\(newDamage\.nature\)/);
  assert.match(source, /Natureza do dano inválida/);
});

test("wound registration stays above the independently refreshed effects list", () => {
  const effectsColumn = template.slice(
    template.indexOf('<div class="footer-column effects-summary">'),
    template.indexOf('<div class="footer-column calculation-summary">'),
  );

  assert.match(effectsColumn, /wound-registration-options[\s\S]+effects-list-summary/);
  assert.match(effectsColumn, /register_wound[\s\S]+existing_wound/);
  assert.doesNotMatch(effectsColumn, /wound_title|wound_notes|<textarea/);
  assert.match(source, /querySelector\("\.effects-list-summary"\)/);
  assert.doesNotMatch(source, /querySelector\("\.effects-summary"\)/);
});