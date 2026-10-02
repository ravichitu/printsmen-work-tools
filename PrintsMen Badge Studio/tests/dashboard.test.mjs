import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {runtimeFiles} from '../scripts/release-files.mjs';
import {createStudioServer} from '../studio-server.mjs';

test('application dashboard reports preview and unconfigured updates honestly',async()=>{
  const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id);}};
  const studio={licence:{state:'preview',mode:'preview',active:true,message:'Local preview'},authentication:{required:true,loggedIn:true},version:'0.9.3',tools:[]};
  const updates={version:'0.9.3',configured:false,installed:true,phase:'unconfigured',message:'Release hosting is not configured.',release:null};
  const fetch=async url=>({ok:true,json:async()=>url.includes('/updates/')?updates:studio});
  const context=vm.createContext({document,fetch,Date});
  new vm.Script(readFileSync(new URL('../dashboard.js',import.meta.url),'utf8')).runInContext(context);
  await vm.runInContext('loadDashboard()',context);
  assert.equal(elements.get('licenceState').textContent,'Local preview');
  assert.match(elements.get('access').textContent,/no production licence/);
  assert.equal(elements.get('feed').textContent,'Not configured');
  assert.equal(elements.get('automatic').textContent,'When editors are closed and the app is idle');
});

test('managed PrintsMen-only installations can read dashboard but not badge editor',async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const files=await runtimeFiles(root);
  for(const name of ['dashboard.html','dashboard.css','dashboard.js'])assert(files.includes(name));
  const server=createStudioServer({root,gate:{status:()=>({mode:'managed',state:'active',active:true,tools:['printsmen.uv-label']})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  for(const name of ['dashboard.html','dashboard.css','dashboard.js'])assert.equal((await fetch(`${origin}/${name}`)).status,200,name);
  assert.equal((await fetch(`${origin}/badge.html`)).status,403);
});

test('dashboard login return is limited to the local dashboard',async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const auth={status:()=>({required:true,loggedIn:false})};
  const server=createStudioServer({root,operatorAuth:auth,gate:{status:()=>({mode:'preview',state:'preview',active:true,tools:[]})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/dashboard.html`,{redirect:'manual'});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/login.html?next=dashboard');
});
