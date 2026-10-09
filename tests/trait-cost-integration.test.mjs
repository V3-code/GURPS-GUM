import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as pricing from '../module/utils/trait-cost.mjs';
import { parseCompendiumLibraryExport } from '../module/utils/compendium-library-json.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({ ...pricing, parseCompendiumLibraryExport, console, Hooks: { on() {} },
  foundry: { utils: { deepClone: structuredClone, randomID: (() => { let id = 0; return () => `test-id-${++id}`; })() } },
  game: { model: { Item: { advantage: { points: 0 }, disadvantage: { points: 0 }, modifier: { cost: '0%' } } }, system: {}, i18n: { localize: key => key } }
});
vm.runInContext(read('module/apps/importers.js').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), context);

test('real trait importer does not turn the calculated GCS total into base points', () => {
  const item = context.parseGCSLibraryTrait({name:'Test',base_points:20,calc:{points:30},modifiers:[{cost_adj:'50%'}]});
  assert.equal(item.system.points,20);
  assert.equal(pricing.calculateItemTraitCost(item).finalPoints,30);
});
test('modifier library import preserves scope and level controls', () => {
  const item = context.parseGCSLibraryModifier({name:'Test',cost_adj:'5%',levels:2,affects:'levels_only',use_level_from_trait:true,cost_ignores_level:true});
  assert.equal(item.system.affects,'levels_only');
  assert.equal(item.system.cost_ignores_level,true);
  assert.equal(item.system.use_level_from_trait,true);
});
test('all four presentation paths delegate to the same pricing function', () => {
  for(const file of ['module/item/gurps-item-sheet.js','module/actor/gurps-actor-sheet.js','scripts/main.js']) {
    const source=read(file);
    assert.doesNotMatch(source,/parseInt\(modifier\??\.cost/);
    assert.match(source,/calculateItemTraitCost\(/);
  }
});
test('template imports keep canonical base separately from their selection cost', async () => {
  context.resolveHybridSourceItem = async () => ({item:null});
  const entry = await context.buildTemplateEntryFromGCSNode({name:'Test',base_points:20,calc:{points:30},modifiers:[{cost_adj:'50%'}]},context.parseGCSLibraryTrait,'advantage');
  assert.equal(entry.cost,30);
  assert.equal(entry.inlineItem.system.points,20);
  assert.deepEqual(JSON.parse(JSON.stringify(entry.trait_cost)), JSON.parse(JSON.stringify(pricing.importGCSTraitCost({base_points:20,modifiers:[{cost_adj:'50%'}]}))));
});

test('GCS skill specialization is retained on the template entry for selection labels', async () => {
  context.resolveHybridSourceItem = async () => ({ item: null });
  const entry = await context.buildTemplateEntryFromGCSNode(
    { name: 'Survival', specialization: 'Arctic', reference: 'B223', points: 1, levels: 0 },
    node => ({ name: node.name, type: 'skill', system: { specialization: node.specialization, difficulty: 'M' } }),
    'skill'
  );
  assert.equal(entry.name, 'Survival');
  assert.equal(entry.specialization, 'Arctic');
  assert.equal(entry.inlineItem.system.specialization, 'Arctic');
});

test('GCS template entry uses the hybrid source when a configured item matches', async () => {
  const source = { id: 'skill-id', uuid: 'Compendium.world.skills.Item.skill-id' };
  context.resolveHybridSourceItem = async () => ({ item: source, matchedBy: 'name+specialization' });
  const entry = await context.buildTemplateEntryFromGCSNode(
    { name: 'Survival', specialization: 'Arctic', reference: 'B223', points: 1, levels: 0 },
    node => ({ name: node.name, type: 'skill', system: { specialization: node.specialization, difficulty: 'M' } }),
    'skill'
  );
  assert.equal(entry.uuid, source.uuid);
  assert.equal(entry.sourceId, source.id);
  assert.equal(entry.hybrid.mode, 'linked');
  assert.equal(entry.ref, 'B223');
  assert.equal(entry.inlineItem, undefined);
  context.resolveHybridSourceItem = async () => ({ item: null });
});

function actorMethods() {
  const ctx = vm.createContext({ ...pricing, TextEditor: {},
    foundry: { appv1: { sheets: { ActorSheet: class {} } }, utils: { deepClone: structuredClone } }
  });
  vm.runInContext(read('module/actor/gurps-actor-sheet.js').replace(/^import .*;\r?\n/gm,'').replace(/\bexport class /g,'class ') + '\nthis.ActorClass = GurpsActorSheet;', ctx);
  return ctx.ActorClass.prototype;
}

test('actor summary, card helper and template application agree on final cost', () => {
  const methods = actorMethods();
  const system = pricing.importGCSTraitCost({base_points:20,modifiers:[{cost_adj:'50%'}]});
  const item={type:'advantage',system};
  const receiver={actor:{items:[item],system:{attributes:{}}},_getPointsNumber:methods._getPointsNumber,
    _calculateAttributePoints:()=>[],_calculateSocialPoints:()=>0,_getCharacteristicFinalPoints:methods._getCharacteristicFinalPoints};
  assert.equal(methods._calculatePointsSummary.call(receiver).spent,30);
  let helper;
  const source=read('scripts/main.js');
  const helperSource=source.slice(source.indexOf('Handlebars.registerHelper("characteristicPoints"'),source.indexOf('const normalizeLookupKey'));
  vm.runInNewContext(helperSource,{...pricing,Handlebars:{registerHelper:(_name,fn)=>{helper=fn;}}});
  assert.equal(helper(item),30);
  const entry={cost:30,trait_cost:system,inlineItem:item};
  const linked=methods._buildActorItemFromTemplateEntry.call({}, {...item,toObject:()=>structuredClone(item)},entry,{id:'template'});
  const inline=methods._buildActorItemFromInlineTemplateEntry.call({},entry,{id:'template'});
  assert.equal(pricing.calculateItemTraitCost(linked).finalPoints,30);
  assert.equal(pricing.calculateItemTraitCost(inline).finalPoints,30);
});

test('library and character traversal preserve inherited modifiers without mutating input', () => {
  const input=[{name:'Parent',modifiers:[{cost_adj:'50%'}],children:[{name:'Child',base_points:20}]}];
  const original=structuredClone(input);
  const fromLibrary=context.collectGCSImportEntries(input)[0].itemData;
  const fromActor=context.collectGCSPricedTraits(input)[0].node;
  for(const row of [fromLibrary,fromActor]) assert.equal(pricing.calculateItemTraitCost(context.parseGCSLibraryTrait(row)).finalPoints,30);
  assert.deepEqual(input,original);
});

test('choosing a library option preserves its operation instead of stripping symbols', () => {
  const input={name:'Choice',base_points:0,modifiers:[{name:'Fixed',cost_adj:'20',disabled:true},{name:'Percentage',cost_adj:'50%',disabled:true}]};
  const rows=context.expandChoiceModifiersAsIndividualRows(input);
  assert.equal(pricing.calculateItemTraitCost(context.parseGCSLibraryTrait(rows[0])).finalPoints,20);
  assert.equal(pricing.calculateItemTraitCost(context.parseGCSLibraryTrait(rows[1])).finalPoints,0);
});

test('modifier browser copies pricing controls into the target item', async () => {
  let update;
  const ctx=vm.createContext({FormApplication:class{},foundry:{utils:{randomID:()=> 'new'}},ui:{notifications:{info(){}}}});
  vm.runInContext(read('module/apps/modifier-browser.js').replace(/^import .*;\r?\n/gm,'').replace('export class ','class ')+'\nthis.Browser=ModifierBrowser;',ctx);
  const browser=new ctx.Browser({update:async data=>{update=data;}});
  const system={cost:'10%',level:3,affects:'base_only',use_level_from_trait:true,cost_ignores_level:true};
  browser.allModifiers=[{id:'abcdefghijklmnop',selectionKey:'modifierSelection-0',uuid:'Compendium.world.modifiers.Item.abcdefghijklmnop',name:'Test',system}];
  await browser._updateObject(null,{'modifierSelection-0':true});
  for(const [key,value] of Object.entries(system))assert.equal(update['system.modifiers.new'][key],value);
  assert.equal(update['system.modifiers.new'].source_id,'Compendium.world.modifiers.Item.abcdefghijklmnop');
});
test('template groups total canonical child costs instead of cached GCS totals', async () => {
  const entry = await context.buildTemplateOptionEntryFromNode({name:'Group',calc:{points:999},modifiers:[{cost_adj:'50%'}],children:[{name:'Child',base_points:20}]},context.parseGCSLibraryTrait,'advantage');
  assert.equal(entry.cost,30);
  assert.equal(entry.subBlocks[0].contents[0].inlineItem.system.points,20);
});

test('GCS template import includes spell and equipment roots with their own costs', async () => {
  context.game.model.Item.template = { blocks: [] };
  context.game.model.Item.spell = { points: 1, predefined: {} };
  context.game.model.Item.equipment = { cost: 0 };
  context.resolveHybridSourceItem = async () => ({ item: null });
  const data = await context.parseGCSTemplate({
    profile: { name: 'Adventurer' },
    spells: [{ name: 'Light', points: 2 }],
    equipment: [{ description: 'Rope', value: '15', quantity: 2 }]
  }, 'test.gct');
  const entries = data.system.blocks.flatMap(block => block.contents);
  assert.deepEqual(Array.from(entries, entry => entry.itemType), ['spell', 'equipment']);
  assert.equal(entries[1].cost, 15);
  assert.equal(entries[1].quantity, 2);
  assert.equal(data.name, 'Adventurer');
});

test('GCS template import preserves a package picker and direct trait roots', async () => {
  context.game.model.Item.template = { blocks: [] };
  context.resolveHybridSourceItem = async () => ({ item: null });
  const data = await context.parseGCSTemplate({ traits: [
    { name: 'Toughness', base_points: 5 },
    { name: 'Travel kit', template_picker: { type: 'count', qualifier: { qualifier: 1 } }, children: [
      { name: 'Strong', children: [{ name: 'Strength', base_points: 10 }] },
      { name: 'Quick', children: [{ name: 'Dexterity', base_points: 20 }] }
    ] }
  ] }, 'test.gct');
  const selection = data.system.blocks.find(block => block.type === 'selection');
  assert.equal(selection.choiceCount, 1);
  assert.equal(selection.contents.length, 2);
  assert.equal(selection.contents[0].kind, 'group');
  assert.equal(selection.contents[0].subBlocks[0].type, 'guaranteed');
  assert.equal(data.system.blocks.some(block => block.type === 'guaranteed' && block.contents.some(entry => entry.name === 'Toughness')), true);
});

test('GCS template import carries a sole root reference into the model', async () => {
  context.game.model.Item.template = { blocks: [] };
  context.resolveHybridSourceItem = async () => ({ item: null });
  const data = await context.parseGCSTemplate({ traits: [
    { name: 'Barbarian', reference: 'B12', children: [{ name: 'Strong', base_points: 10 }] }
  ] }, 'barbarian.gct');
  assert.equal(data.system.ref, 'B12');
});

test('batch template reader accepts multiple files and rejects an invalid file before import', async () => {
  context.game.model.Item.template = { blocks: [] };
  context.resolveHybridSourceItem = async () => ({ item: null });
  const files = [
    { name: 'one.gct', text: async () => JSON.stringify({ profile: { name: 'One' }, traits: [{ name: 'A', base_points: 5 }] }) },
    { name: 'two.gct', text: async () => JSON.stringify({ profile: { name: 'Two' }, traits: [{ name: 'B', base_points: 10 }] }) }
  ];
  const templates = await context.readGCSTemplateFiles(files);
  assert.equal(templates.length, 2);
  assert.equal(templates[0].type, 'template');
  await assert.rejects(context.readGCSTemplateFiles([...files, { name: 'bad.gct', text: async () => '{}' }]), /bad\.gct/);
});

test('template reader accepts native GUM items and portable GUM compendium exports', async () => {
  const native = { _id: 'template-1', name: 'Barbarian', type: 'template', system: { blocks: [] } };
  const files = [
    { name: 'barbarian.json', text: async () => JSON.stringify(native) },
    { name: 'collection.json', text: async () => JSON.stringify({
      format: 'gum-compendium-library', version: 1, documentType: 'Item', folders: [],
      documents: [{ ...native, _id: 'template-2', name: 'Warrior' }, { _id: 'skill-1', type: 'skill', name: 'Sword' }]
    }) }
  ];
  const templates = await context.readGCSTemplateFiles(files);
  assert.deepEqual(Array.from(templates, item => item.name), ['Barbarian', 'Warrior']);
  assert.equal(templates[0].system.blocks.length, 0);
});

test('batch template writer uses one compendium, rewrites internal references, and restores its lock', async () => {
  const events = [];
  context.Item = { async createDocuments(items, options) {
    events.push(['create', items.length, options.pack, options.keepId]);
    const reference = items[0].system.blocks[0].contents[0];
    assert.equal(reference.sourceId, items[1]._id);
    assert.equal(reference.uuid, `Compendium.${options.pack}.Item.${items[1]._id}`);
  } };
  const pack = { collection: 'world.gcs-templates', locked: true, async configure(data) {
    events.push(['lock', data.locked]);
    this.locked = data.locked;
  } };
  await context.createGCSTemplatesInCompendium(pack, [
    { _id: 'old-a', type: 'template', system: { blocks: [{ contents: [{ kind: 'template', sourceId: 'old-b', uuid: 'Item.old-b' }] }] } },
    { _id: 'old-b', type: 'template', system: { blocks: [] } }
  ]);
  assert.deepEqual(events, [['lock', false], ['create', 2, 'world.gcs-templates', true], ['lock', true]]);
  assert.equal(pack.locked, true);
});
