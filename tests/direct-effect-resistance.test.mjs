import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../scripts/main.js", import.meta.url), "utf8");
const actorSheet = readFileSync(new URL("../module/actor/gurps-actor-sheet.js", import.meta.url), "utf8");
const gmScreen = readFileSync(new URL("../module/apps/gm-screen.js", import.meta.url), "utf8");

test("aplicações diretas passam pelo despachante da Barreira de Resistência", () => {
  assert.match(main, /export async function applyEffectWithResistance[\s\S]*if \(!resistanceRoll\.isResisted\)[\s\S]*applySingleEffect[\s\S]*_promptActivationResistance/);
});

test("arrastar Item de Efeito para a ficha solicita resistência antes de aplicar", () => {
  assert.match(actorSheet, /if \(item\?\.type === "effect"\)[\s\S]*applyEffectWithResistance\(item, targets/);
  assert.doesNotMatch(actorSheet, /if \(item\?\.type === "effect"\)[\s\S]{0,300}applySingleEffect\(item, targets/);
});

test("Escudo do Mestre solicita resistência antes de aplicar Item de Efeito", () => {
  assert.match(gmScreen, /for \(const effectUuid of effectUuids\)[\s\S]*applyEffectWithResistance\(effectItem, targets/);
  assert.doesNotMatch(gmScreen, /for \(const effectUuid of effectUuids\)[\s\S]{0,600}applySingleEffect\(effectItem, targets/);
});

test("aplicações vinculadas não ignoram testes silenciosos", () => {
  const guardedApplications = [...main.matchAll(/if \(requiresResistance\)([^]*?)\} else \{([^]*?)\}/g)];
  assert.ok(guardedApplications.length >= 2);
  for (const match of guardedApplications.slice(0, 2)) {
    assert.match(match[1], /_promptActivationResistance/);
    assert.match(match[2], /applySingleEffect/);
  }
});