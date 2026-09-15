import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Run the real converters without starting Foundry or changing their public API.
const source = readFileSync(new URL('../module/apps/importers.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
let id = 0;
const context = vm.createContext({
  console,
  Hooks: { on() {} },
  foundry: { utils: { deepClone: structuredClone, randomID: () => String(++id) } },
  game: { model: { Item: {
    equipment: { quantity: 1 }, attack_ranged: { mode: '' }, attack_melee: { mode: '' },
    skill: { points: 0, predefined: {} }, spell: { points: 0 }
  } }, system: {} }
});
vm.runInContext(source, context);
const criterion = qualifier => ({ compare: 'is', qualifier });

test('Longbow: modern GCS skill criteria become a usable Bow reference', () => {
  const item = context.parseGCSLibraryEquipment({
    description: 'Longbow', base_weight: '3 lb', weapons: [{
      damage: { type: 'imp', st: 'thr', base: '2' }, accuracy: '3', range: 'x15/x20',
      defaults: [{ type: 'dx', modifier: -5 }, { type: 'skill', name: criterion('Bow') }]
    }]
  });
  assert.equal(Object.values(item.system.ranged_attacks)[0].skill_name, 'DX-5, Bow');
});

test('skill defaults retain name, specialization and modifier', () => {
  const item = context.parseGCSLibrarySkill({ name: 'Example', difficulty: 'dx/a', defaults: [
    { type: 'skill', name: criterion('Guns'), specialization: criterion('Rifle'), modifier: -2 }
  ] });
  assert.equal(item.system.predefined.slot1.name, 'Guns');
  assert.equal(item.system.predefined.slot1.specialization, 'Rifle');
  assert.equal(item.system.predefined.slot1.modifier, -2);
});

test('legacy strings and modern criteria produce the same attack references', () => {
  const defaults = name => [{ type: 'skill', name, specialization: 'Rifle', modifier: -2 }];
  assert.equal(context.formatGCSDefaultsRollReferenceList(defaults(criterion('Guns'))),
    context.formatGCSDefaultsRollReferenceList(defaults('Guns')));
});

test('spell attack names also accept modern criteria', () => {
  const item = context.parseGCSLibrarySpell({ name: 'Example', weapons: [{
    defaults: [{ type: 'skill', name: criterion('Innate Attack') }], damage: {}
  }] });
  assert.equal(item.system.attack_roll.skill_name, 'Innate Attack');
});

test('unsupported comparisons are rejected rather than silently treated as equality', () => {
  assert.throws(() => context.normalizeGCSDefault({ type: 'skill',
    name: { compare: 'contains', qualifier: 'Sword' }
  }), /contains/);
});

test('empty wildcard specialization remains unrestricted', () => {
  assert.equal(context.normalizeGCSDefault({ type: 'skill', name: criterion('Guns'),
    specialization: { compare: 'any' }
  }).specialization, '');
});

test('GCS omits the qualifier when an exact specialization is empty', () => {
  assert.equal(context.normalizeGCSDefault({ type: 'skill', name: criterion('Survival'),
    specialization: { compare: 'is' }
  }).specialization, '');
});

test('technique criteria are decoded before resolving placeholders', () => {
  const input = { name: 'Targeted Attack', difficulty: 'h', points: 2,
    default: { type: 'skill', name: criterion('@skill@'),
      specialization: criterion('Rifle'), modifier: -4 },
    replacements: { skill: 'Guns' } };
  const original = structuredClone(input);
  const item = context.parseGCSLibrarySkill(input);
  assert.equal(item.system.base_attribute, 'Guns (Rifle)');
  assert.equal(item.system.predefined.slot1.name, 'Guns');
  assert.deepEqual(input, original);
});

test('melee references preserve modifiers and remove equivalent duplicates', () => {
  const item = context.parseGCSLibraryEquipment({ description: 'Sword', weapons: [{
    reach: '1', damage: {}, defaults: [
      { type: 'skill', name: criterion('Broadsword'), modifier: -2 },
      { type: 'skill', name: 'Broadsword', modifier: -2 },
      { type: 'dx', modifier: -5 }
    ]
  }] });
  assert.equal(Object.values(item.system.melee_attacks)[0].skill_name, 'Broadsword-2, DX-5');
});

test('character skill reconciliation also normalizes modern defaults', () => {
  const item = { type: 'skill', system: {} };
  context.applyGCSDefaultsToImportedCharacterSkill(item, {
    defaults: [{ type: 'skill', name: criterion('Bow'), modifier: -2 }]
  });
  assert.equal(item.system.predefined.slot1.name, 'Bow');
});
