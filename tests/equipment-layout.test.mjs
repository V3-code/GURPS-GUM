import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");

test("character tabs follow the requested workflow", () => {
  const nav = template.slice(template.indexOf('<nav class="sheet-tabs tabs"'), template.indexOf("</nav>"));
  const order = [...nav.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(order, [
    "combat", "skills", "characteristics", "social", "spells",
    "powers", "equipment", "biography", "conditions", "modifiers"
  ]);
  assert.match(styles, /\.container-section-header \{\s+gap: 20px;/);
  assert.match(styles, /\.gum\.sheet\.actor \.container-section-header \{[\s\S]*?border: none;/);
  assert.doesNotMatch(styles, /\.sheet-tabs \.item i \{ font-size:/);
});

test("equipment containers expose weight, capacity and drop zones", () => {
  assert.match(template, /Peso: \{\{this\.container\.system\.total_weight\}\} kg/);
  assert.match(template, /container-capacity-meter/);
  assert.match(template, /Container vazio — arraste itens para cá/);
  assert.match(template, /data-organizer-group-id="container:\{\{this\.container\._id\}\}"/);
  assert.match(template, /data-organizer-group-id="carried"/);
});

test("equipment drag and drop stays silent after a successful move", () => {
  const organizer = actorSheet.slice(
    actorSheet.indexOf("this._equipmentOrganizerCleanup = attachSheetItemOrganizer"),
    actorSheet.indexOf("// Alternar Modo de Visualização de Perícias")
  );
  assert.match(organizer, /updateEmbeddedDocuments\('Item'/);
  assert.doesNotMatch(organizer, /ui\.notifications\.info/);
});
