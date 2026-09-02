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

test("wound registration is in the right body column without an existing-wound dropdown", () => {
  const rightBodyColumn = template.slice(
    template.indexOf('<div class="body-column situational-mods-panel">'),
    template.indexOf('</main>'),
  );
  const effectsColumn = template.slice(
    template.indexOf('<div class="footer-column effects-summary">'),
    template.indexOf('<div class="footer-column calculation-summary">'),
  );

  assert.match(rightBodyColumn, /wound-registration-options[\s\S]+name="register_wound"/);
  assert.doesNotMatch(effectsColumn, /register_wound|wound-registration-options/);
  assert.doesNotMatch(template, /name="existing_wound"|Criar novo card|Somar a:/);
  assert.doesNotMatch(source, /existingWounds|existing_wound|syncCompatibleWounds/);
  assert.match(source, /querySelector\("\.effects-list-summary"\)/);
  assert.doesNotMatch(source, /querySelector\("\.effects-summary"\)/);
});

test("selecting a combat meter uses its DR in the custom hit location", () => {
  assert.match(template, /data-pool-type="{{pool\.type}}" data-dr="{{pool\.dr}}"/);
  assert.match(source, /type: "combat-meter",[\s\S]+dr: Math\.max\(0, Number\(meter\.dr\) \|\| 0\)/);
  assert.match(source, /selectedPool\?\.dataset\.poolType !== "combat-meter"/);
  assert.match(source, /customDR\.value = String\(Math\.max\(0, Number\(selectedPool\.dataset\.dr\) \|\| 0\)\)/);
  assert.match(source, /location-row\[data-location-key="custom"\][\s\S]+customLocation\?\.click\(\)/);
});