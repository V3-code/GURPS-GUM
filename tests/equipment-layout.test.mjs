import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

test("character tabs follow the requested workflow", () => {
  const nav = template.slice(template.indexOf('<nav class="sheet-tabs tabs"'), template.indexOf("</nav>"));
  const order = [...nav.matchAll(/data-tab="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(order, [
    "combat", "skills", "characteristics", "social", "spells",
    "powers", "equipment", "biography", "conditions", "modifiers"
  ]);
  assert.match(styles, /\.sheet-tabs \.item i \{ font-size: 18px; \}/);
  assert.match(styles, /\.container-section-header \{\s+gap: 20px;/);
});

test("equipment containers expose weight, capacity and drop zones", () => {
  assert.match(template, /Peso: \{\{this\.container\.system\.total_weight\}\} kg/);
  assert.match(template, /container-capacity-meter/);
  assert.match(template, /Container vazio — arraste itens para cá/);
  assert.match(template, /data-organizer-group-id="container:\{\{this\.container\._id\}\}"/);
  assert.match(template, /data-organizer-group-id="carried"/);
});
