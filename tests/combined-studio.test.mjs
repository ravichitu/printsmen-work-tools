import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('combined home preserves both editor entry points and old badge-size link',()=>{
  const home=read('index.html'),badge=read('badge.html'),redirect=read('badge-sizes.html');
  assert.match(home,/href="badge.html"/);
  assert.match(home,/href="printsmen\/index.html"/);
  assert.match(badge,/id="projectName"/);
  assert.match(badge,/href="index.html"/);
  assert.match(redirect,/badge.html#badge/);
  assert.match(read('printsmen/printsmen-ui.js'),/studioHome.href='\.\.\/index.html'/);
});
test('merged PrintsMen uses a local profile without embedded password authentication',()=>{
  const html=read('printsmen/index.html');
  assert.doesNotMatch(html,/CREDENTIALS|loginPass|password:\s*\d|passEl|Wrong password/);
  assert.match(html,/Local session profile \(not secure authentication\)/);
  assert.match(html,/Start Local Session/);
  let count=0;
  for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim()){new vm.Script(m[1]);count++;}
  assert.equal(count,9);
  for(const name of ['printsmen-ui.js','printsmen-pdf.js'])new vm.Script(read('printsmen/'+name));
});
test('combined runtime includes the local scripts and PDF worker it references',()=>{
  for(const page of ['index.html','badge.html','printsmen/index.html']){
    const html=read(page),url=new URL('../'+page,import.meta.url);
    for(const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)){
      if(/^(?:https?:|data:|#)/.test(match[1]))continue;
      assert(fs.existsSync(new URL(match[1],url)),page+': '+match[1]);
    }
  }
  for(const name of ['legacy/build/pdf.min.mjs','legacy/build/pdf.worker.min.mjs','LICENSE'])assert(fs.existsSync(new URL('../printsmen/printsmen-vendor/pdfjs/'+name,import.meta.url)));
});
