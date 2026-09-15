import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../module/apps/importers.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
let id = 0;
const context = vm.createContext({
  Hooks: { on() {} },
  foundry: { utils: { randomID: () => `container-${++id}`,
    mergeObject: (target, update) => ({ ...target, ...update }) } }
});
vm.runInContext(source, context);
// Isolate inventory placement from compendium lookup; simulate a stored source item.
context.buildHybridActorItemFromGCS = async node => ({
  name: node.description, type: 'equipment',
  system: { location: 'stored', stored: true, equipped: false }
});

const tree = [{ description: 'Other equipment', equipped: true, children: [
  { description: 'Backpack', children: [
    { description: 'Waterskin', equipped: true, children: [
      { description: 'Water', equipped: true }
    ] },
    { description: 'Rations', equipped: false }
  ] }
] }];

test('the source category wins over equipped flags on containers and descendants', async () => {
  const items = await context.buildGCSCharacterEquipmentItems(tree, { location: 'carried' });
  for (const item of items) {
    assert.equal(item.system.location, 'carried', item.name);
    assert.equal(item.system.equipped, false, item.name);
    assert.equal(item.system.stored, false, item.name);
  }
});

test('nested inventory keeps parent links and the source category', async () => {
  const original = structuredClone(tree);
  const items = await context.buildGCSCharacterEquipmentItems(tree, { location: 'equipped' });
  const [root, pack, skin, water, rations] = items;
  assert.equal(root.system.parent_container_id, '');
  assert.equal(pack.system.parent_container_id, root._id);
  assert.equal(skin.system.parent_container_id, pack._id);
  assert.equal(water.system.parent_container_id, skin._id);
  assert.equal(rations.system.parent_container_id, pack._id);
  assert.equal(new Set([root._id, pack._id, skin._id]).size, 3);
  for (const item of items) {
    assert.equal(item.system.location, 'equipped');
    assert.equal(item.system.equipped, true);
    assert.equal(item.system.stored, false);
  }
  assert.deepEqual(tree, original);
});

test('character import maps the two GCS lists to equipped and carried, never stored', async () => {
  const items = await context.buildGCSCharacterInventoryItems({
    equipment: [{ description: 'Bow', equipped: false }], other_equipment: tree
  });
  assert.equal(items[0].system.location, 'equipped');
  for (const item of items.slice(1)) assert.equal(item.system.location, 'carried');
  assert.equal(items.some(item => item.system.stored), false);
  assert.equal((await context.buildGCSCharacterInventoryItems({})).length, 0);
});
