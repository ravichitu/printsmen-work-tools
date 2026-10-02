import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, rmdir, copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes, randomUUID, createCipheriv, createDecipheriv, generateKeyPairSync} from 'node:crypto';
import {LicenceStore} from '../licensing/store.mjs';
import {registerInstallation, InstallationGate, MARKER} from '../licensing/installation.mjs';
import {authorityFingerprint, issueLicence, verifyLicence} from '../licensing/licence.mjs';
import {TOOL_CATALOG, validateTools} from '../licensing/catalog.mjs';
import {OnlineActivation, validateAuthority} from '../licensing/online.mjs';
import {windowsProtection, windowsMachineHash} from '../licensing/windows.mjs';
import {createStudioServer} from '../studio-server.mjs';
import {installManaged, uninstallManaged, validateManagedTarget} from '../setup/managed-install.mjs';
import {makeOperatorConfig, createOperatorAuth} from '../licensing/operator-auth.mjs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const appRoot=fileURLToPath(new URL('../',import.meta.url));
const testRoot=path.join(appRoot,'test-output','licensing');
await mkdir(testRoot,{recursive:true});
const ownerRoot=new URL('../../PrintsMen Licence Manager/',import.meta.url);
let owner, authorityServer, bundle;
try {
  owner=await import(new URL('authority.mjs',ownerRoot));
  authorityServer=await import(new URL('server.mjs',ownerRoot));
  bundle=await import(new URL('build-managed.mjs',ownerRoot));
} catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const integration={skip:!owner&&'Owner utility is deliberately not distributed with operator/local editor packages.'};
const password='test-only-owner-password-123456';
function protection() {
  const key=randomBytes(32);
  return {
    async protect(text){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(text,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');},
    async unprotect(text){const raw=Buffer.from(text,'base64'),decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(-16));return Buffer.concat([decipher.update(raw.subarray(12,-16)),decipher.final()]).toString('utf8');}
  };
}
async function fixture(t) {
  const root=await mkdtemp(path.join(testRoot,'case-'));
  t.after(async()=>{const resolved=path.resolve(root);assert(resolved.startsWith(path.resolve(testRoot)+path.sep));await rm(resolved,{recursive:true,force:true});});
  const pair=generateKeyPairSync('ed25519');
  const publicKey=pair.publicKey.export({type:'spki',format:'pem'}),privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'});
  const machineHash='a'.repeat(64),folder=path.join(root,'app');await mkdir(folder);
  const store=new LicenceStore(path.join(root,'state','ledger'),protection());
  const installation=await registerInstallation({root:folder,store,machineHash,publicKey});
  const gate=new InstallationGate({root:folder,store,machineHash,publicKey});
  return {root,folder,store,gate,installation,publicKey,privateKey,machineHash};
}
async function listen(t,server) {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return 'http://127.0.0.1:'+server.address().port;
}
async function stateStore(root,state) {
  const store=new LicenceStore(path.join(root,'authority','ledger'),protection());
  await store.change(value=>Object.assign(value,state),{allowNew:true});return store;
}
async function call(base,url,body,{cookie,csrf,origin=base}={}) {
  const headers={};if(cookie)headers.Cookie=cookie;if(csrf)headers['X-Owner-CSRF']=csrf;
  if(body!==undefined){headers['Content-Type']='application/json';if(origin)headers.Origin=origin;}
  const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {response,value:await response.json()};
}

test('catalogue covers Badge Studio and every legacy page without duplicate IDs',async()=>{
  const html=await readFile(path.join(appRoot,'printsmen','index.html'),'utf8');
  const pages=[...html.matchAll(/class="tab(?: active)?" data-page="(page\d+)"/g)].map(m=>m[1]).filter(p=>p!=='page0');
  assert.equal(TOOL_CATALOG.length,21);assert.deepEqual(TOOL_CATALOG.filter(t=>t.page).map(t=>t.page),pages);
  assert.throws(()=>validateTools([]));assert.throws(()=>validateTools(['badge','badge']));assert.throws(()=>validateTools(['not-real']));
});

test('operator, activation and owner dashboard browser scripts parse',async()=>{
  for(const name of ['login.js','session.js','activation.js'])new vm.Script(await readFile(path.join(appRoot,name),'utf8'));
  if(owner)execFileSync(process.execPath,['--check',fileURLToPath(new URL('dashboard.js',ownerRoot))]);
  for(const name of ['login.html','activation.html']){
    const html=await readFile(path.join(appRoot,name),'utf8');
    for(const match of html.matchAll(/(?:href|src)="([^"#]+\.(?:css|js))"/g))await readFile(path.join(appRoot,match[1]));
  }
});

test('failed oversized state write preserves previous data and releases its lock',async t=>{
  const f=await fixture(t),before=await f.store.read();
  await assert.rejects(()=>f.store.change(state=>{state.padding='x'.repeat(1000000);}),/storage is full/);
  assert.deepEqual(await f.store.read(),before);
  await f.store.change(state=>{state.auditCheck=true;});assert.equal((await f.store.read()).auditCheck,true);
});

test('simultaneous owner approvals cannot bind one key to two installations',integration,async t=>{
  const f=await fixture(t),state=await owner.newAuthority(password);
  const key=owner.generateLicenceKey(state,{customer:'Race test',tools:['badge']});
  const first={...(await f.gate.request()),authorityFingerprint:authorityFingerprint(state.publicKey),licenceKey:key.key};
  const second={...first,installationId:randomUUID(),challenge:randomBytes(32).toString('hex')};
  owner.requestActivation(state,first);owner.requestActivation(state,second);
  const store=await stateStore(f.root,state);
  const decisions=await Promise.allSettled([store.change(value=>owner.decideActivation(value,first.installationId,'approve')),store.change(value=>owner.decideActivation(value,second.installationId,'approve'))]);
  assert.equal(decisions.filter(result=>result.status==='fulfilled').length,1);
  const after=await store.read();assert.equal(after.requests.filter(request=>request.state==='approved').length,1);assert(after.keys[0].boundInstallation);
});

test('signed licence persists across server restarts and cannot be edited or copied',async t=>{
  const f=await fixture(t),request=await f.gate.request();
  const licence=issueLicence(request,f.privateKey,'Test shop',['badge']);
  assert.equal((await f.gate.status()).state,'pending');
  await f.gate.activate(licence);
  const restored=new InstallationGate({root:f.folder,store:new LicenceStore(f.store.file,f.store.protection),machineHash:f.machineHash,publicKey:f.publicKey});
  const status=await restored.status();assert.equal(status.active,true);assert.deepEqual(status.tools,['badge']);assert(Number.isFinite(Date.parse(status.activatedAt)));assert.equal(status.term,'installation-lifetime');
  const altered=JSON.parse(Buffer.from(licence.payload,'base64url'));
  altered.tools.push('printsmen.uv-label');
  await assert.rejects(()=>f.gate.activate({...licence,payload:Buffer.from(JSON.stringify(altered)).toString('base64url')}),/signature/);
  const foreign=new InstallationGate({root:f.folder,store:f.store,machineHash:'b'.repeat(64),publicKey:f.publicKey});assert.equal((await foreign.status()).active,false);
  const copied=path.join(f.root,'copy');await mkdir(copied);await copyFile(path.join(f.folder,MARKER),path.join(copied,MARKER));
  assert.equal((await new InstallationGate({root:copied,store:f.store,machineHash:f.machineHash,publicKey:f.publicKey}).status()).active,false);
  assert.equal((await f.gate.status()).active,true,'invalid replacement does not erase a valid licence');
});

test('retirement invalidates old approval; fresh install requires a fresh signed receipt',async t=>{
  const f=await fixture(t);const old=issueLicence(await f.gate.request(),f.privateKey,'Shop');await f.gate.activate(old);await f.gate.retire();
  assert.equal((await f.gate.status()).active,false);
  await rm(path.join(f.folder,MARKER));
  const next=await registerInstallation({root:f.folder,store:f.store,machineHash:f.machineHash,publicKey:f.publicKey});
  assert.notEqual(next.installationId,f.installation.installationId);
  await assert.rejects(()=>f.gate.activate(old),/another installation/);
  await f.gate.activate(issueLicence(await f.gate.request(),f.privateKey,'Shop'));
  assert.equal((await f.gate.status()).active,true);assert.equal((await f.store.read()).retired.length,1);
});

test('missing/corrupt state and changed authority fail closed, never auto-activate',async t=>{
  const f=await fixture(t),other=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
  assert.equal((await new InstallationGate({...f,root:f.folder,publicKey:other}).status()).active,false);
  await writeFile(f.store.file,'corrupt');assert.equal((await f.gate.status()).active,false);
  await rm(f.store.file);assert.equal((await f.gate.status()).active,false);
  await assert.rejects(()=>f.gate.request());
});

test('authority URLs require HTTPS; offline/redirect errors cannot activate',async t=>{
  const f=await fixture(t);
  for(const url of ['http://example.com','http://127.0.0.1:4290','https://localhost','https://example.com/path','https://u:p@example.com'])assert.throws(()=>validateAuthority({schema:1,url,publicKey:f.publicKey}));
  const activation=new OnlineActivation({gate:f.gate,config:{schema:1,url:'https://activation.example',publicKey:f.publicKey},fetcher:async()=>{throw new Error('offline');}});
  await assert.rejects(()=>activation.activate('Shop','PM1-'+randomBytes(24).toString('base64url')),/Connect to the internet/);
  assert.equal((await f.gate.status()).active,false);
});

test('Windows DPAPI round trip and stable machine identity', {skip:process.platform!=='win32'}, async()=>{
  const original='test licence state '+randomUUID();const encrypted=await windowsProtection.protect(original);
  assert(!encrypted.includes(original));assert.equal(await windowsProtection.unprotect(encrypted),original);
  const machine=await windowsMachineHash();assert.match(machine,/^[0-9a-f]{64}$/);assert.equal(await windowsMachineHash(),machine);
});

test('owner keys are unique, tools are signed, and only one installation can bind each key',integration,async t=>{
  const f=await fixture(t),state=await owner.newAuthority(password);
  const first=owner.generateLicenceKey(state,{customer:'Customer',tools:['printsmen.uv-label']});
  const second=owner.generateLicenceKey(state,{customer:'Other',tools:['badge']});assert.notEqual(first.key,second.key);assert(!JSON.stringify(state).includes(first.key));
  const request={...(await f.gate.request()),authorityFingerprint:authorityFingerprint(state.publicKey),licenceKey:first.key};
  assert.equal(owner.requestActivation(state,request).state,'pending');
  owner.decideActivation(state,request.installationId,'approve');
  const reply=owner.requestActivation(state,request);const data=verifyLicence(reply.licence,state.publicKey,request);assert.deepEqual(data.tools,['printsmen.uv-label']);
  assert.throws(()=>owner.requestActivation(state,{...request,installationId:randomUUID()}),/already bound/);
  const view=owner.dashboard(state);assert.equal(view.requests[0].confirmedAt,null);assert.equal(view.requests[0].approvedAt,data.issuedAt);
  owner.confirmActivation(state,{...request,licenceId:data.licenceId});assert(view.requests[0].status.includes('awaiting'));
  const confirmed=owner.dashboard(state);assert(confirmed.requests[0].confirmedAt);assert(!JSON.stringify(confirmed).includes(state.privateKey));assert(!JSON.stringify(confirmed).includes(request.challenge));
});

test('owner HTTP dashboard enforces password/session/CSRF and records an online client activation',integration,async t=>{
  const f=await fixture(t),state=await owner.newAuthority(password),store=await stateStore(f.root,state);
  const base=await listen(t,authorityServer.createAuthorityServer({store,testMode:true}));
  assert.equal((await call(base,'/api/dashboard')).response.status,401);
  assert.equal((await call(base,'/api/keys',{customer:'No',tools:['badge']})).response.status,401);
  assert.equal((await call(base,'/api/login',{password},{origin:'https://evil.example'})).response.status,403);
  assert.equal((await call(base,'/api/login',{password:'wrong'})).response.status,401);
  const login=await call(base,'/api/login',{password});assert.equal(login.response.status,200);
  const cookie=login.response.headers.get('set-cookie').split(';')[0];assert.match(login.response.headers.get('set-cookie'),/HttpOnly/);
  const dash=await call(base,'/api/dashboard',undefined,{cookie});const csrf=dash.value.csrf;
  assert.equal((await call(base,'/api/keys',{customer:'Test',tools:['badge']},{cookie})).response.status,403);
  const client={contactPerson:'Test Contact',phone:'9000000000',email:'sample@example.test',address:'Test address',reference:'QA'};
  const generated=await call(base,'/api/keys',{customer:'Test customer',client,tools:['badge']},{cookie,csrf});assert.equal(generated.response.status,201);
  // Install a new identity under the tested authority, not the fixture's separate key pair.
  await f.gate.retire();await rm(path.join(f.folder,MARKER));await registerInstallation({root:f.folder,store:f.store,machineHash:f.machineHash,publicKey:state.publicKey});
  const gate=new InstallationGate({root:f.folder,store:f.store,machineHash:f.machineHash,publicKey:state.publicKey});
  const activation=new OnlineActivation({gate,config:{schema:1,url:base,publicKey:state.publicKey},allowTestHttp:true});
  await assert.rejects(()=>activation.activate('Wrong client',generated.value.key,client),/does not match/);
  assert.equal((await activation.activate('Test customer',generated.value.key,client)).state,'pending');assert.equal((await gate.status()).active,false);
  const pending=await call(base,'/api/dashboard',undefined,{cookie});const id=pending.value.requests[0].installationId;
  assert.equal((await call(base,'/api/decision',{installationId:id,decision:'approve'},{cookie,csrf})).response.status,200);
  const active=await activation.activate('Test customer',generated.value.key,client);assert.equal(active.active,true);assert.equal(active.confirmation,'recorded');
  const confirmed=await call(base,'/api/dashboard',undefined,{cookie});assert(confirmed.value.requests[0].confirmedAt);assert.equal(confirmed.value.requests[0].approvedAt,active.activatedAt);
  const offline=new OnlineActivation({gate,config:{schema:1,url:'https://activation.example',publicKey:state.publicKey},fetcher:async()=>{throw Error('offline');}});
  await assert.rejects(()=>offline.activate('Test',generated.value.key));assert.equal((await gate.status()).active,true,'already approved installation survives loss of internet');
  const replacement=await call(base,'/api/recover',{keyId:generated.value.id,recoveryKey:generated.value.recoveryKey},{cookie,csrf});assert.equal(replacement.response.status,201);
  await gate.retire();await rm(path.join(f.folder,MARKER));await registerInstallation({root:f.folder,store:f.store,machineHash:f.machineHash,publicKey:state.publicKey});
  await assert.rejects(()=>activation.activate('Test customer',generated.value.key,client),/replaced/);
  assert.equal((await activation.activate('Test customer',replacement.value.key,client)).state,'pending');assert.equal((await gate.status()).active,false);
  const newId=(await gate.request()).installationId;assert.notEqual(newId,id);
  assert.equal((await call(base,'/api/decision',{installationId:newId,decision:'approve'},{cookie,csrf})).response.status,200);
  assert.equal((await activation.activate('Test customer',replacement.value.key,client)).active,true);
  assert.equal((await call(base,'/api/logout',{}, {cookie,csrf})).response.status,200);assert.equal((await call(base,'/api/dashboard',undefined,{cookie})).response.status,401);
});

test('application server gates workspaces, hides private paths and rejects file-import activation',async t=>{
  const f=await fixture(t);
  for(const name of ['index.html','badge.html','activation.html','activation.js','activation.css','app.js'])await copyFile(path.join(appRoot,name),path.join(f.folder,name));
  await mkdir(path.join(f.folder,'printsmen'));await copyFile(path.join(appRoot,'printsmen','index.html'),path.join(f.folder,'printsmen','index.html'));
  const base=await listen(t,createStudioServer({root:f.folder,gate:f.gate}));
  assert.equal((await fetch(base+'/badge.html',{redirect:'manual'})).status,303);assert.equal((await fetch(base+'/app.js')).status,403);
  assert.equal((await fetch(base+'/activation.html')).status,200);
  for(const file of ['/server.mjs','/licensing/store.mjs','/activation-authority.json','/setup/managed-install.mjs'])assert.equal((await fetch(base+file)).status,404);
  assert.equal((await fetch(base+'/'+MARKER)).status,403);
  const state=await (await fetch(base+'/api/studio/status')).json();
  assert.equal((await fetch(base+'/api/licence/activate',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://evil.example','X-Studio-CSRF':state.csrf},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/licence/activate',{method:'POST',headers:{'Content-Type':'application/json','Origin':base,'X-Studio-CSRF':state.csrf},body:JSON.stringify({licence:issueLicence(await f.gate.request(),f.privateKey,'Shop')})})).status,503);
  await f.gate.activate(issueLicence(await f.gate.request(),f.privateKey,'Shop',['badge']));
  assert.equal((await fetch(base+'/badge.html')).status,200);assert.equal((await fetch(base+'/printsmen/index.html')).status,403);
  await f.gate.activate(issueLicence(await f.gate.request(),f.privateKey,'Shop',['printsmen.uv-label']));
  assert.equal((await fetch(base+'/badge.html')).status,403);
  const html=await (await fetch(base+'/printsmen/index.html')).text();assert.match(html,/PRINTSMEN_ALLOWED_PAGES=Object.freeze\(\["page15"\]\)/);
  await f.gate.retire();assert.equal((await fetch(base+'/printsmen/index.html',{redirect:'manual'})).status,303);
});

test('managed bundle excludes owner secrets; uninstall/reinstall rejects old receipt and preserves extra files',integration,async t=>{
  const f=await fixture(t),destination=path.join(f.root,'installer');
  const config={schema:1,url:'https://activation.example',publicKey:f.publicKey};
  const built=await bundle.buildManagedBundle({appRoot,destination,config,operatorConfig:await makeOperatorConfig('test','test-password')});assert(built.files>400);
  const manifest=JSON.parse(await readFile(path.join(built.payload,'managed-manifest.json'),'utf8'));
  assert(!manifest.files.some(file=>/private|authority\.mjs|test-output|tests\/|\.dpapi/.test(file.path)));
  assert.match(await readFile(path.join(built.payload,'server.mjs'),'utf8'),/configurationError/);
  assert(!manifest.files.some(file=>file.path==='managed-server.mjs'));
  const base=path.join(f.root,'Programs'),target=path.join(base,'PrintsMen Badge Studio');
  const store=new LicenceStore(path.join(f.root,'managed-state','ledger'),protection());
  const first=await installManaged({source:built.payload,target,base,store,machineHash:f.machineHash});
  const gate=new InstallationGate({root:target,store,machineHash:f.machineHash,publicKey:f.publicKey});
  const receipt=issueLicence(await gate.request(),f.privateKey,'Shop',['badge']);await gate.activate(receipt);
  await assert.rejects(()=>installManaged({source:built.payload,target,base,store,machineHash:f.machineHash}),/already exists/);
  await writeFile(path.join(target,'customer-artwork.txt'),'keep this');
  const result=await uninstallManaged({target,base,store,machineHash:f.machineHash});assert.equal(result.remaining,true);assert.equal(await readFile(path.join(target,'customer-artwork.txt'),'utf8'),'keep this');assert.equal((await gate.status()).active,false);
  await rm(path.join(target,'customer-artwork.txt'));await rmdir(target);
  const second=await installManaged({source:built.payload,target,base,store,machineHash:f.machineHash});assert.notEqual(second.installationId,first.installationId);
  await assert.rejects(()=>gate.activate(receipt),/another installation/);
  await gate.activate(issueLicence(await gate.request(),f.privateKey,'Shop',['badge']));assert.equal((await gate.status()).active,true);
  assert.throws(()=>validateManagedTarget(path.join(f.root,'unrelated'),base),/dedicated/);
});

test('preview operator login gates pages/assets and survives logout without bypassing managed licensing',async t=>{
  const f=await fixture(t);
  for(const name of ['index.html','badge.html','activation.html','activation.js','activation.css','app.js','login.html','login.js','session.js'])await copyFile(path.join(appRoot,name),path.join(f.folder,name));
  const config=await makeOperatorConfig('testuser','test-password');
  assert(!JSON.stringify(config).includes('test-password'));
  const base=await listen(t,createStudioServer({root:f.folder,edition:'preview',operatorAuth:createOperatorAuth(config)}));
  const denied=await fetch(base+'/index.html',{redirect:'manual'});assert.equal(denied.status,303);assert.equal(denied.headers.get('location'),'/login.html');
  assert.equal((await fetch(base+'/app.js')).status,401);assert.equal((await fetch(base+'/login.html')).status,200);
  assert.equal((await call(base,'/api/session/login',{username:'testuser',password:'wrong'})).response.status,401);
  assert.equal((await call(base,'/api/session/login',{username:'testuser',password:'test-password'},{origin:'https://evil.example'})).response.status,403);
  const logged=await call(base,'/api/session/login',{username:'testuser',password:'test-password'});assert.equal(logged.response.status,200);
  const cookie=logged.response.headers.get('set-cookie').split(';')[0];assert.match(logged.response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const state=await call(base,'/api/studio/status',undefined,{cookie});assert.equal(state.value.authentication.loggedIn,true);assert.equal(state.value.licence.state,'preview');
  assert.equal((await fetch(base+'/badge.html',{headers:{Cookie:cookie}})).status,200);
  assert.match(await (await fetch(base+'/index.html',{headers:{Cookie:cookie}})).text(),/LOCAL PREVIEW/);
  const loggedOut=await fetch(base+'/api/session/logout',{method:'POST',headers:{Origin:base,Cookie:cookie,'X-Studio-CSRF':state.value.csrf}});assert.equal(loggedOut.status,200);
  assert.equal((await fetch(base+'/app.js',{headers:{Cookie:cookie}})).status,401);
  const managed=await listen(t,createStudioServer({root:f.folder,gate:f.gate,operatorAuth:createOperatorAuth(config)}));
  const login=await call(managed,'/api/session/login',{username:'testuser',password:'test-password'});const managedCookie=login.response.headers.get('set-cookie').split(';')[0];
  const locked=await fetch(managed+'/badge.html',{redirect:'manual',headers:{Cookie:managedCookie}});assert.equal(locked.status,303);assert.equal(locked.headers.get('location'),'/activation.html');
});
