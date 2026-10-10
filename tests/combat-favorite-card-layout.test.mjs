import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../templates/actors/characters.hbs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");

const favorites = template.slice(
  template.indexOf('class="combat-favorites-root-content"'),
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
  assert.match(favorites, /magic-card__detail-branch--mechanics/);
  assert.match(favorites, /GUM\.Spells\.CastingTime/);
  assert.match(favorites, /GUM\.Powers\.ActivationTime/);
  assert.match(favorites, /rollable combat-favorite-card__metric/);
  assert.match(favorites, /rollable-damage/);
  assert.match(favorites, /item-quick-view gum-action-menu__item/);
  assert.match(favorites, /item-edit gum-action-menu__item/);
  assert.match(favorites, /item-delete gum-action-menu__item is-danger/);
});

test("favorite cards use two columns and expanded magic cards span the group", () => {
  assert.match(styles, /combat-favorites-root-content > \.attack-group-details > \.group-content \{\s*display:grid;\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /combat-favorite-card\.is-expanded \{ grid-column:1 \/ -1; \}/);
  assert.match(styles, /combat-favorite-card__main \{ width:100%; grid-template-columns:28px minmax\(0,1fr\) 30px minmax\(0,58px\) 16px 16px; \}/);
  assert.match(styles, /max-width:760px[^}]+combat-favorites-root-content > \.attack-group-details > \.group-content \{ grid-template-columns:1fr;/);
});

test("combat actions and favorites use a subtle persistent view switcher", () => {
  assert.match(template, /class="combat-view-switcher"[^>]+role="tablist"/);
  assert.match(template, /data-combat-view="actions"[^>]+role="tab"/);
  assert.match(template, /data-combat-view="favorites"[^>]+role="tab"/);
  assert.match(template, /data-combat-panel="actions"[^>]+role="tabpanel"/);
  assert.match(template, /data-combat-panel="favorites"[^>]+role="tabpanel"/);
  assert.doesNotMatch(favorites, /combat-favorites-wrapper|combat-favorites-root"/);
  assert.match(styles, /combat-view-tab\.is-active::after \{ background:#b99047; \}/);
  assert.match(styles, /combat-action-panel\[hidden\] \{ display:none !important; \}/);
  assert.match(actorSheet, /this\._combatActionView \?\?= "actions"/);
  assert.match(actorSheet, /this\._combatActionView = view/);
  assert.match(actorSheet, /panel\.hidden = panel\.dataset\.combatPanel !== view/);
  const switcher = template.slice(
    template.indexOf('class="combat-view-switcher"'),
    template.indexOf('{{!-- Favoritos de combate --}}'),
  );
  assert.doesNotMatch(switcher, /combatFavoriteCount|<small>/);
});

test("combat favorites are grouped by item type while retaining their source group as metadata", () => {
  const favoritePreparation = actorSheet.slice(
    actorSheet.indexOf("const combatFavoriteTypes"),
    actorSheet.indexOf("//    FIM DA FASE 3.1"),
  );

  assert.match(favoritePreparation, /const favoriteGroupByType = new Map/);
  assert.match(favoritePreparation, /favoriteGroupByType\.get\(item\.type\)/);
  assert.match(favoritePreparation, /favoriteItem\.combatFavoriteOriginGroup/);
  assert.doesNotMatch(favoritePreparation, /const typedGroup/);
  assert.match(favorites, /this\.combatFavoriteOriginGroup/);
});

test("combat groups use wrapping multi-select filters with an all option", () => {
  assert.match(template, /combat-filter-list--actions/);
  assert.match(template, /data-filter-scope="actions" data-filter-value="all"/);
  assert.match(template, /data-combat-filter-group="\{\{group\.id\}\}"/);
  assert.match(template, /combat-filter-list--control/);
  assert.match(template, /data-filter-scope="control" data-filter-value="wounds"/);
  assert.match(template, /data-filter-scope="control" data-filter-value="meters"/);
  assert.match(template, /data-combat-control-group="wounds"/);
  assert.match(template, /data-combat-control-group="meters"/);
  assert.match(styles, /\.combat-filter-list \{[\s\S]*?flex-wrap:wrap/);
  assert.match(styles, /\.combat-filter-chip\.is-active/);
  assert.match(actorSheet, /this\._combatAttackFilters \?\?= new Set\(\)/);
  assert.match(actorSheet, /this\._combatControlFilters \?\?= new Set\(\)/);
  assert.match(actorSheet, /html\.on\("click", "\.combat-filter-chip"/);
  assert.match(actorSheet, /if \(value === "all"\) filters\.clear\(\)/);
});
