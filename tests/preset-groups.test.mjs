import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,PRESET_GROUPS} from '../core.js';

test('preset categories include each existing size exactly once',()=>{
  const ids=PRESET_GROUPS.flatMap(group=>group.ids);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual([...ids].sort(),PRESETS.map(p=>p.id).sort());
  assert.deepEqual(PRESET_GROUPS.slice(0,4).map(g=>g.name),['Round Badges','Rectangle Badges','Polaroids','Square Badges']);
});
test('category membership distinguishes product type from geometric shape',()=>{
  assert.deepEqual(PRESET_GROUPS.find(g=>g.name==='Round Badges').ids,['round75','round58','round44','round32']);
  assert.deepEqual(PRESET_GROUPS.find(g=>g.name==='Polaroids').ids,['polaroid']);
  assert.deepEqual(PRESET_GROUPS.find(g=>g.name==='Square Badges').ids,['square50']);
});
