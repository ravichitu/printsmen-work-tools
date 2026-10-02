import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {PRESETS,PRESET_GROUPS,validateBadge} from '../core.js';
import {catalogueCategories,catalogueMarkup,projectFromCatalogue} from '../catalogue.js';
import {runtimeFiles} from '../scripts/release-files.mjs';
import {createStudioServer} from '../studio-server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('home shows eight compact categories plus custom without dimensions or workspace previews',()=>{
  const html=catalogueCategories();
  assert.deepEqual([...html.matchAll(/data-open-catalogue="([^"]+)"/g)].map(m=>m[1]),['0','1','2','3','4','5','6','7','custom']);
  assert.doesNotMatch(html,/Face:|Cut:|Safe:|data-start-preset|canvas/);
});
test('catalogue contains every category and preset exactly once',()=>{
  const html=catalogueMarkup();
  assert.equal((html.match(/data-catalogue-group=/g)||[]).length,PRESET_GROUPS.length);
  assert.deepEqual([...html.matchAll(/data-start-preset="([^"]+)"/g)].map(m=>m[1]).sort(),PRESETS.map(p=>p.id).sort());
  for(const group of PRESET_GROUPS)assert.ok(html.includes(group.name));
  assert.equal((html.match(/Face:/g)||[]).length,16);
  assert.equal((html.match(/Cut:/g)||[]).length,16);
  assert.equal((html.match(/Safe:/g)||[]).length,16);
});
test('each catalogue starts a separate project with its exact measured geometry',()=>{
  for(const preset of PRESETS){
    const a=projectFromCatalogue(preset.id),b=projectFromCatalogue(preset.id);
    assert.deepEqual(a.pages[0].badge,preset);
    assert.notEqual(a.pages[0].id,b.pages[0].id);
    assert.equal(a.pages.length,1);assert.equal(a.pages[0].objects.length,0);
    a.pages[0].badge.w=999;
    assert.deepEqual(b.pages[0].badge,preset);
    validateBadge(b.pages[0].badge);
  }
});
test('custom starts with valid independent dimensions; unknown sizes are rejected',()=>{
  const badge=projectFromCatalogue('custom').pages[0].badge;
  assert.equal(badge.id,'custom');validateBadge(badge);
  assert.throws(()=>projectFromCatalogue('invalid'),/Choose an available/);
});
test('landing markup hides the editor before scripts load and provides recovery actions',async()=>{
  const html=await readFile(new URL('../badge.html',import.meta.url),'utf8');
  assert.match(html,/<body class="catalogue-mode">/);
  assert.match(html,/<div id="editorWorkspace" hidden>/);
  assert.match(html,/<div id="catalogueGroups" hidden>/);
  assert.match(html,/<section id="catalogueCustom" class="catalogue-custom" hidden>/);
  for(const id of ['catalogueHome','catalogueGroups','catalogueFilters','resumeWorkspace','catalogueOpen','catalogueLibrary','showCatalogue'])assert.ok(html.includes(`id="${id}"`));
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/keydown',e=>\{if\(\$\('editorWorkspace'\)\.hidden\|\|busy/);
  assert.match(app,/if\(hasWorkspace&&!await confirmReplace/);
});
test('catalogue module is both served locally and included in installers',async()=>{
  assert.ok((await runtimeFiles(root)).includes('catalogue.js'));
  const server=createStudioServer({root});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/catalogue.js`);
    assert.equal(response.status,200);
    assert.match(await response.text(),/projectFromCatalogue/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
