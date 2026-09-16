import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = readFileSync(new URL('../templates/items/item-sheet.hbs', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/item-sheet.css', import.meta.url), 'utf8');
const sheetScript = readFileSync(new URL('../module/item/gurps-item-sheet.js', import.meta.url), 'utf8');

test('advantage and disadvantage cost controls share one dashboard section', () => {
  const start = template.indexOf('data-trait-cost-editor');
  const end = template.indexOf('Mecânica e Contexto', start);
  assert.ok(start >= 0 && end > start);
  const block = template.slice(start, end);

  for (const field of [
    'system.can_level',
    'system.round_down',
    'system.multiplicative_modifiers',
    'system.points',
    'system.points_per_level',
    'system.level',
    'system.cost_multiplier'
  ]) assert.match(block, new RegExp(field.replace('.', '\\.')));

  assert.match(block, /Custo Final/);
  assert.doesNotMatch(template, /Nível e Pontos/);
});

test('the separate legacy cost block remains limited to powers', () => {
  assert.match(template, /\{\{#if \(eq item\.type "power"\)\}\}[\s\S]*?<div class="form-section"><h4 class="section-title">Cálculo do custo<\/h4>/);
  assert.doesNotMatch(template, /\{\{#if \(or \(eq item\.type "advantage"\) \(eq item\.type "disadvantage"\) \(eq item\.type "power"\)\)\}\}\s*<div class="form-section"><h4 class="section-title">Cálculo do custo<\/h4>/);
});

test('modifier pricing fields and options use the dedicated dashboard', () => {
  const start = template.indexOf('data-modifier-cost-editor');
  const end = template.indexOf('Referência e Contexto', start);
  assert.ok(start >= 0 && end > start);
  const block = template.slice(start, end);

  assert.match(block, /Cálculo do Modificador/);
  assert.match(block, /modifier-cost-input/);
  assert.match(block, /modifier-affects-select/);
  assert.match(block, /modifier-level-input/);
  assert.match(block, /modifier-use-trait-level/);
  assert.match(block, /modifier-ignore-level/);
  assert.match(template, /Referência e Contexto/);
});

test('cost-dependent inputs have render-time visual state handlers', () => {
  assert.match(sheetScript, /updateTraitCostLevelState/);
  assert.match(sheetScript, /trait-cost-level-dependent/);
  assert.match(sheetScript, /updateModifierCostState/);
  assert.match(sheetScript, /\^\(\?:x\|×\)/);
  assert.match(sheetScript, /disableOwnLevel = ignoresLevel \|\| useTraitLevel/);
});

test('cost workspaces provide responsive grids and a distinct result card', () => {
  assert.match(styles, /\.characteristic-cost-grid/);
  assert.match(styles, /\.characteristic-cost-result-card/);
  assert.match(styles, /\.modifier-cost-core-grid/);
  assert.match(styles, /\.modifier-cost-options/);
  assert.match(styles, /\.is-cost-disabled/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /\.characteristic-cost-result small[\s\S]*?white-space: pre-line/);
});
