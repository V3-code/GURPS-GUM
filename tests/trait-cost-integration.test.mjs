import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as pricing from '../module/utils/trait-cost.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({ ...pricing, console, Hooks: { on() {} },
  foundry: { utils: { deepClone: structuredClone, randomID: () => 'test-id' } },
  game: { model: { Item: { advantage: { points: 0 }, disadvantage: { points: 0 }, modifier: { cost: '0%' } } }, system: {} }
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
  browser.allModifiers=[{id:'abcdefghijklmnop',name:'Test',system}];
  await browser._updateObject(null,{abcdefghijklmnop:true});
  for(const [key,value] of Object.entries(system))assert.equal(update['system.modifiers.new'][key],value);
});
test('template groups total canonical child costs instead of cached GCS totals', async () => {
  const entry = await context.buildTemplateOptionEntryFromNode({name:'Group',calc:{points:999},modifiers:[{cost_adj:'50%'}],children:[{name:'Child',base_points:20}]},context.parseGCSLibraryTrait,'advantage');
  assert.equal(entry.cost,30);
  assert.equal(entry.subBlocks[0].contents[0].inlineItem.system.points,20);
});
