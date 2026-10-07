import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {UpdateManager} from '../updates/manager.mjs';
import {updateConfig,verifyRelease,compareVersions,sha256,UPDATE_PRODUCT} from '../updates/release.mjs';
import {applyPreviewUpdate} from '../setup/apply-preview-update.mjs';
import {createStudioServer} from '../studio-server.mjs';
import {makeOperatorConfig,createOperatorAuth} from '../licensing/operator-auth.mjs';
import {runtimeFiles} from '../scripts/release-files.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const keys=generateKeyPairSync('ed25519');
const config={schema:1,channel:'preview',feedUrl:'https://updates.example.test/feed.json',publicKey:keys.publicKey.export({type:'spki',format:'pem'}),checkIntervalHours:6};
const installer=Buffer.from('MZ-synthetic-test-installer-never-executed');
function signed(overrides={}){
  const data={schema:1,product:UPDATE_PRODUCT,channel:'preview',version:'0.8.0',url:'https://updates.example.test/setup.exe',bytes:installer.length,sha256:sha256(installer),publishedAt:'2026-09-24T00:00:00Z',notes:'Test release.',...overrides};
  const payload=Buffer.from(JSON.stringify(data));return {payload:payload.toString('base64url'),signature:sign(null,payload,keys.privateKey).toString('base64url')};
}
async function temp(t){const base=await mkdtemp(path.join(tmpdir(),'printsmen-update-test-'));assert.equal(path.dirname(path.resolve(base)),path.resolve(tmpdir()));t.after(()=>rm(base,{recursive:true,force:true}));return base;}
async function manager(t,options={}){
  const cache=await temp(t);let clock=1000,launches=0;
  const result=new UpdateManager({root,config,version:'0.7.0',cache,installed:true,now:()=>clock,launch:async()=>{launches++;},fetcher:async(url,init)=>{
    assert.equal(init.redirect,'follow');return new Response(url.endsWith('feed.json')?JSON.stringify(signed()):installer);
  },...options});
  return {manager:result,advance:ms=>clock+=ms,get launches(){return launches;}};
}
test('signed feeds reject tampering, wrong product/channel and unsafe addresses',()=>{
  const c=updateConfig(config);assert.equal(verifyRelease(signed(),c).version,'0.8.0');
  assert.throws(()=>verifyRelease({...signed(),payload:Buffer.from('{}').toString('base64url')},c),/signature/);
  for(const patch of [{product:'other'},{channel:'stable'},{url:'http://unsafe.test/setup.exe'},{bytes:0},{sha256:'bad'}])assert.throws(()=>verifyRelease(signed(patch),c));
  assert.throws(()=>updateConfig({...config,feedUrl:'https://user:password@updates.test/feed.json'}));
  assert.equal(updateConfig({...config,feedUrl:''}).configured,false);
  assert(compareVersions('0.7.10','0.7.2')>0);assert(compareVersions('0.7.0','0.7.0-preview.1')>0);
  assert.throws(()=>compareVersions('bad','0.7.0'));
});
test('unconfigured update manager makes no network requests',async t=>{
  const f=await manager(t,{config:{schema:1,channel:'preview',feedUrl:'',publicKey:''},fetcher:()=>{throw new Error('Unexpected request');}});
  await f.manager.tick();await f.manager.check();assert.equal(f.manager.status().phase,'unconfigured');assert.equal(f.launches,0);
});
test('automatic download waits for closed editor tabs and five idle minutes',async t=>{
  const f=await manager(t),m=f.manager,id=m.openClient('badge.html');
  await m.tick();assert.equal(m.phase,'downloaded');f.advance(400000);await m.tick();assert.equal(f.launches,0);
  m.heartbeat({id,closed:true});f.advance(299999);await m.tick();assert.equal(f.launches,0);
  f.advance(2);await m.tick();assert.equal(f.launches,1);assert.equal(m.phase,'installing');
});
test('stale/suspended clients and recent activity block automatic install',async t=>{
  const f=await manager(t),m=f.manager,id=m.openClient('index.html');await m.tick();
  f.advance(400000);assert.equal(m.isIdle(),false);
  m.heartbeat({id,active:true});assert.equal(m.isIdle(),false);
  f.advance(300001);m.heartbeat({id,active:false});await m.tick();assert.equal(f.launches,1);
});
test('source folders never auto-install; same-version/older releases are skipped',async t=>{
  const f=await manager(t,{installed:false});await f.manager.tick();assert.equal(f.manager.phase,'available');assert.equal(f.launches,0);
  const old=await manager(t,{fetcher:async()=>new Response(JSON.stringify(signed({version:'0.6.0'})))});
  await old.manager.check();assert.equal(old.manager.phase,'current');assert.equal(old.manager.release,null);
});
test('corrupt downloads and modified cached installers cannot execute',async t=>{
  const bad=await manager(t,{fetcher:async url=>new Response(url.endsWith('feed.json')?JSON.stringify(signed()):Buffer.from('invalid'))});
  await bad.manager.tick();assert.equal(bad.manager.phase,'error');assert.equal(bad.launches,0);
  const f=await manager(t);await f.manager.tick();await writeFile(f.manager.downloaded,'tampered');
  await f.manager.install({manual:true});assert.equal(f.manager.phase,'error');assert.equal(f.launches,0);
});
async function updateFixture(t){
  const base=await temp(t),source=path.join(base,'payload'),target=path.join(base,'installed');
  await mkdir(source);await mkdir(target);
  async function build(dir,version,contents){
    const files=[];for(const [name,text] of Object.entries(contents)){await mkdir(path.dirname(path.join(dir,name)),{recursive:true});await writeFile(path.join(dir,name),text);files.push({path:name,hash:sha256(Buffer.from(text))});}
    await writeFile(path.join(dir,'preview-manifest.json'),JSON.stringify({schema:1,product:UPDATE_PRODUCT,version,files}));
  }
  await build(target,'0.6.0-preview.1',{'app.js':'old','old.js':'obsolete','operator-auth.json':'original login','updates-config.json':'original owner key'});
  await build(source,'0.7.0-preview.1',{'app.js':'new','new/data.txt':'added','operator-auth.json':'replacement login','updates-config.json':'replacement owner key'});
  const marker={product:UPDATE_PRODUCT,root:target,installationId:'test-installation'};
  await writeFile(path.join(target,'.preview-installation.json'),JSON.stringify(marker));await writeFile(path.join(target,'customer-artwork.txt'),'keep this');
  return {source,target,marker};
}
test('in-place update preserves identity, operator settings, trust key and user files',async t=>{
  const f=await updateFixture(t),result=await applyPreviewUpdate(f);
  assert.equal(result.installationId,f.marker.installationId);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.target,'.preview-installation.json'),'utf8')),f.marker);
  for(const [file,expected] of Object.entries({'app.js':'new','new/data.txt':'added','operator-auth.json':'original login','updates-config.json':'original owner key','customer-artwork.txt':'keep this'}))assert.equal(await readFile(path.join(f.target,file),'utf8'),expected);
  assert.equal(await access(path.join(f.target,'old.js')).then(()=>true,()=>false),false);
  assert.equal(await access(path.join(f.target,'.update-pending')).then(()=>true,()=>false),false);
});
test('same-version installer repair is allowed but downgrades remain blocked',async t=>{
  const f=await updateFixture(t);
  await applyPreviewUpdate(f);
  await assert.rejects(()=>applyPreviewUpdate({...f}),/same version/);
  const result=await applyPreviewUpdate({...f,allowSameVersion:true});
  assert.equal(result.version,'0.7.0-preview.1');
  const sourceManifest=JSON.parse(await readFile(path.join(f.source,'preview-manifest.json'),'utf8'));
  sourceManifest.version='0.5.0-preview.1';
  await writeFile(path.join(f.source,'preview-manifest.json'),JSON.stringify(sourceManifest));
  await assert.rejects(()=>applyPreviewUpdate({...f,allowSameVersion:true}),/older/);
});
test('failed file update rolls back the changed application files',async t=>{
  const f=await updateFixture(t),oldManifest=await readFile(path.join(f.target,'preview-manifest.json'),'utf8');
  await assert.rejects(()=>applyPreviewUpdate({...f,beforeWrite:name=>{if(name==='new/data.txt')throw new Error('Simulated disk failure');}}),/disk failure/);
  assert.equal(await readFile(path.join(f.target,'app.js'),'utf8'),'old');
  assert.equal(await readFile(path.join(f.target,'preview-manifest.json'),'utf8'),oldManifest);
  assert.equal(await readFile(path.join(f.target,'customer-artwork.txt'),'utf8'),'keep this');
});
test('modified installations, bad payloads, path traversal and unknown file collisions fail safely',async t=>{
  const f=await updateFixture(t);await writeFile(path.join(f.target,'app.js'),'custom edit');
  await assert.rejects(()=>applyPreviewUpdate(f),/modified/);assert.equal(await readFile(path.join(f.target,'app.js'),'utf8'),'custom edit');
  const b=await updateFixture(t);await writeFile(path.join(b.source,'app.js'),'bad');await assert.rejects(()=>applyPreviewUpdate(b),/verification/);
  const c=await updateFixture(t);await mkdir(path.join(c.target,'new'));await writeFile(path.join(c.target,'new/data.txt'),'user file');await assert.rejects(()=>applyPreviewUpdate(c),/unrecognised/);
  const d=await updateFixture(t),manifest=JSON.parse(await readFile(path.join(d.source,'preview-manifest.json'),'utf8'));manifest.files[0].path='../escape.txt';await writeFile(path.join(d.source,'preview-manifest.json'),JSON.stringify(manifest));await assert.rejects(()=>applyPreviewUpdate(d),/Unsafe/);
});
test('update routes require a login and CSRF; private signing/config files are not served',async t=>{
  const f=await manager(t),operatorAuth=createOperatorAuth(await makeOperatorConfig('tester','test-password'));
  const server=createStudioServer({root,operatorAuth,updates:f.manager});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await fetch(base+'/api/updates/status')).status,401);
    const login=await fetch(base+'/api/session/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'tester',password:'test-password'})});
    const Cookie=login.headers.get('set-cookie').split(';')[0],state=await(await fetch(base+'/api/studio/status',{headers:{Cookie}})).json();
    assert.equal((await fetch(base+'/api/updates/check',{method:'POST',headers:{Cookie,Origin:base,'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/updates/check',{method:'POST',headers:{Cookie,Origin:base,'Content-Type':'application/json','X-Studio-CSRF':state.csrf},body:'{}'})).status,200);
    for(const file of ['updates-config.json','updates/manager.mjs','private/update-signing.dpapi'])assert.equal((await fetch(base+'/'+file,{headers:{Cookie}})).status,404);
    const html=await(await fetch(base+'/badge.html',{headers:{Cookie}})).text();assert.match(html,/updates-client.js.*data-client=/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('theme and update manager ship in the runtime and reduced-motion is respected',async()=>{
  const files=await runtimeFiles(root);for(const name of ['badge-theme.css','Start Update Manager.cmd','updates.html','updates/manager.mjs','setup/apply-preview-update.mjs'])assert(files.includes(name));
  const css=await readFile(new URL('../badge-theme.css',import.meta.url),'utf8');assert.match(css,/prefers-reduced-motion:reduce/);assert.doesNotMatch(css,/\[data-object\]|#board\s*svg/);
});
