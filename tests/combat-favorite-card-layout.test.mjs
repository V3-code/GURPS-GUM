import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

const favorites = template.slice(
  template.indexOf('class="group-content combat-favorites-root-content"'),
  template.indexOf("{{!-- Bloco de Lista de ataque --}}"),
);

test("combat favorites share the compact card structure without legacy magic rows", () => {
  assert.match(favorites, /combat-favorite-card--trait/);
  assert.match(favorites, /combat-favorite-card--skill/);
  assert.match(favorites, /combat-favorite-card--magic/);
  assert.match(favorites, /combat-favorite-card__identity/);
  assert.match(favorites, /combat-favorite-card__metric/);
  assert.match(favorites, /combat-favorite-card__controls/);
  assert.doesNotMatch(favorites, /spell-row-v3|spell-card-two-line|spell-card-primary|spell-card-secondary/);
});

test("favorite spells and powers keep rolls, details, menus, and drag support", () => {
  assert.match(favorites, /class="item magic-card combat-favorite-card/);
  assert.match(favorites, /draggable="true"/);
  assert.match(favorites, /magic-card__expand combat-favorite-card__expand/);
  assert.match(favorites, /magic-card__details combat-favorite-card__details/);
  assert.match(favorites, /rollable combat-favorite-card__metric/);
  assert.match(favorites, /rollable-damage/);
  assert.match(favorites, /item-quick-view gum-action-menu__item/);
  assert.match(favorites, /item-edit gum-action-menu__item/);
  assert.match(favorites, /item-delete gum-action-menu__item is-danger/);
});

test("favorite cards use two columns and expanded magic cards span the group", () => {
  assert.match(styles, /combat-favorites-root-content > \.attack-group-details > \.group-content \{\s*display:grid;\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /combat-favorite-card\.is-expanded \{ grid-column:1 \/ -1; \}/);
  assert.match(styles, /combat-favorite-card__main \{ grid-template-columns:28px minmax\(100px,1fr\) 34px minmax\(54px,74px\) 18px 18px; \}/);
  assert.match(styles, /max-width:760px[^}]+combat-favorites-root-content > \.attack-group-details > \.group-content \{ grid-template-columns:1fr;/);
});
