import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTraitCost, parseTraitAdjustment, importGCSTraitCost } from '../module/utils/trait-cost.mjs';

const calculate = (points, modifiers = [], extra = {}) => calculateTraitCost({ points, modifiers, ...extra });
test('fixed points, percentages, multipliers and decimals remain distinct', () => {
  for (const [cost, expected] of [['+5',25], ['-5',15], ['+50%',30], ['x2',40], ['x50%',10], ['12.5%',23]]) {
    assert.equal(calculate(20, [{cost}]).finalPoints, expected, cost);
  }
  assert.equal(calculate(100, [{cost:'12.5%'}]).finalPoints, 113);
  assert.throws(() => parseTraitAdjustment('garbage'), /inválido/);
});
test('fixed additions precede percentages; the cap applies only to percentages', () => {
  assert.equal(calculate(20, [{cost:'5'}, {cost:'50%'}, {cost:'x2'}]).finalPoints,75);
  assert.equal(calculate(20, [{cost:'-100'}]).finalPoints,-80);
  assert.equal(calculate(20, [{cost:'-100%'}, {cost:'50%'}]).finalPoints,10);
  assert.equal(calculate(20, [{cost:'-100%'}]).finalPoints,4);
});
test('round once, respecting the sign and round_down', () => {
  assert.equal(calculate(3,[{cost:'10%'}]).finalPoints,4);
  assert.equal(calculate(3,[{cost:'10%'}],{round_down:true}).finalPoints,3);
  assert.equal(calculate(-3,[{cost:'10%'}]).finalPoints,-3);
  assert.equal(calculate(-3,[{cost:'10%'}],{round_down:true}).finalPoints,-4);
  assert.equal(calculate(0).finalPoints,0);
});
test('base and per-level components have independent percentage scopes', () => {
  const extra={can_level:true,level:3,points_per_level:5};
  assert.equal(calculate(10,[{cost:'50%',affects:'base_only'}],extra).finalPoints,30);
  assert.equal(calculate(10,[{cost:'50%',affects:'levels_only'}],extra).finalPoints,33);
  assert.equal(calculate(10,[{cost:'2',affects:'levels_only'}],extra).finalPoints,31);
});
test('modifier levels, owner levels, ignored cost levels and disabled groups', () => {
  assert.equal(calculate(20,[{cost:'10%',level:3}]).finalPoints,26);
  assert.equal(calculate(20,[{cost:'10%',level:3,cost_ignores_level:true}]).finalPoints,22);
  assert.equal(calculate(20,[{cost:'10%',use_level_from_trait:true}],{can_level:true,level:2}).finalPoints,24);
  assert.equal(calculate(20,[{disabled:true,children:[{cost:'50%'}]},{children:[{cost:'5'}]}]).finalPoints,25);
});
test('multiplicative percentage option is explicit', () => {
  const mods=[{cost:'100%'},{cost:'-80%'}];
  assert.equal(calculate(100,mods).finalPoints,120);
  assert.equal(calculate(100,mods,{multiplicative_modifiers:true}).finalPoints,40);
});
test('GCS base and levels are imported; calc.points is never retained or reused', () => {
  const data=importGCSTraitCost({base_points:20,calc:{points:30},modifiers:[{cost_adj:'50%'}]});
  assert.equal(data.points,20);
  assert.equal(calculateTraitCost(data).finalPoints,30);
  assert.ok(!('calc' in data));
  assert.equal(calculateTraitCost(importGCSTraitCost({can_level:true,levels:3,points_per_level:5})).finalPoints,15);
  assert.equal(calculateTraitCost(importGCSTraitCost({modifiers:[{name:'One weapon',cost_adj:'20'}],calc:{points:20}})).finalPoints,20);
});
test('GCS inheritance, self-control and missing base are explicit', () => {
  const data=importGCSTraitCost({base_points:20,modifiers:[{cost_adj:'5'}]},[{cost_adj:'50%'}]);
  assert.equal(calculateTraitCost(data).finalPoints,38);
  assert.equal(calculateTraitCost(importGCSTraitCost({base_points:-10,cr:6})).finalPoints,-20);
});
test('invalid data does not produce a plausible zero cost', () => {
  assert.throws(()=>calculate(20,[{cost:'foo'}]), /inválido/);
  assert.throws(()=>calculate(20,[{cost:'5',affects:'unknown'}]), /escopo/);
});

test('cost explanation separates composition, adjustments and rounding', () => {
  const plain = calculate(10, [], {can_level:true, points_per_level:5, level:3});
  assert.equal(plain.compositionDescription, 'Composição: 10 da base + 15 dos 3 níveis = 25');
  assert.equal(plain.adjustmentsDescription, '');
  assert.equal(plain.roundingDescription, '');

  const adjusted = calculate(10, [
    {cost:'+2', affects:'base_only'},
    {cost:'+50%', affects:'base_only'},
    {cost:'-20%', affects:'levels_only'},
    {cost:'x2'}
  ], {can_level:true, points_per_level:5, level:3});
  assert.equal(adjusted.finalPoints, 60);
  assert.equal(adjusted.compositionDescription, 'Composição: 18 da base + 12 dos 3 níveis = 30');
  assert.equal(adjusted.adjustmentsDescription,
    'Ajustes: +2 pts na base · +50% na base · −20% nos níveis · subtotal ×2');

  const rounded = calculate(3, [{cost:'+10%'}, {cost:'x2'}]);
  assert.equal(rounded.roundingDescription, 'Arredondamento: 6,6 → 7');
});

test('cost explanation identifies modifier levels, caps and round-down', () => {
  const scaled = calculate(20, [{cost:'+10%', level:3}]);
  assert.equal(scaled.finalPoints, 26);
  assert.equal(scaled.adjustmentsDescription, 'Ajustes: +10% × 3 na base e nos níveis');

  const capped = calculate(20, [{cost:'-100%'}]);
  assert.equal(capped.adjustmentsDescription,
    'Ajustes: −100% na base e nos níveis · saldo percentual em base: −100% → −80%');

  const roundedDown = calculate(-3, [{cost:'+10%'}], {round_down:true});
  assert.equal(roundedDown.roundingDescription, 'Arredondamento para baixo: −3,3 → −4');
});
