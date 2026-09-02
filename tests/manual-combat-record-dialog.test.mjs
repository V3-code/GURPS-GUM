import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles/styles.css", import.meta.url), "utf8");

test("manual wound and combat record dialogs use the shared minimal editor", () => {
  assert.match(actorSheet, /gum-wound-form gum-record-editor/);
  assert.match(actorSheet, /gum-combat-meter-form gum-record-editor/);
  assert.match(actorSheet, /gum-wound-edit-dialog/);
  assert.match(actorSheet, /gum-record-field--title[\s\S]+gum-record-field--nature[\s\S]+gum-record-field--initial/);
  assert.match(actorSheet, /gum-wound-edit-dialog"\], width: 600, height: "auto"/);
  assert.match(actorSheet, /Registro de combate[\s\S]+Acompanhe manualmente/);
});

test("record editor favors subtle colored surfaces and responsive layout", () => {
  assert.match(styles, /\.gum-record-editor__intro \{[^}]+background:rgba\(255,255,255,\.035\)/);
  assert.match(styles, /\.gum-record-editor__icon--blue \{[^}]+rgba\(126,165,188,\.12\)/);
  assert.match(styles, /\.gum-record-field--title \{ grid-column:span 6;/);
  assert.match(styles, /\.gum-record-field--nature \{ background:rgba\(139,116,80,\.12\)/);
  assert.match(styles, /\.gum-record-edit-dialog \.dialog-content input,[\s\S]+border:0;/);
  assert.match(styles, /max-width:520px[\s\S]+\.gum-record-editor__section \{ grid-template-columns:minmax\(0,1fr\)/);
});