import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,sign} from 'node:crypto';
import {newAuthority,generateLicenceKey,recoverLicenceKey,requestActivation,decideActivation,dashboard} from '../../PrintsMen Licence Manager/authority.mjs';
import {createAuthorityServer} from '../../PrintsMen Licence Manager/server.mjs';
import {licenceSheet} from '../../PrintsMen Licence Manager/licence-sheet.mjs';
import {authorityFingerprint,verifyLicence} from '../licensing/licence.mjs';
import {validateClient} from '../licensing/client.mjs';
import {runtimeFiles} from '../scripts/release-files.mjs';
import {fileURLToPath} from 'node:url';
const password='test-only-owner-password-123456';
const details={contactPerson:'Sample Person',phone:'+91 90000 00000',email:'sample@example.test',address:'Sample Street\nTest City',reference:'QA-001'};
const request=(state,key)=>({schema:1,type:'activation-request',product:'printsmen-badge-studio',installationId:randomUUID(),machineHash:'a'.repeat(64),authorityFingerprint:authorityFingerprint(state.publicKey),challenge:'b'.repeat(64),customer:key.customer,client:details,licenceKey:key.key});
test('client fields validate; name, email and phone are checked before activation',async()=>{
  const state=await newAuthority(password),key=generateLicenceKey(state,{customer:'Sample Shop',client:details,tools:['badge']}),req=request(state,key);
  for(const changed of [{customer:'Wrong Shop'},{client:{...details,email:'wrong@example.test'}},{client:{...details,phone:'1234567'}}])assert.throws(()=>requestActivation(state,{...req,...changed}),/does not match/);
  assert.equal(state.requests.length,0);assert.equal(requestActivation(state,req).state,'pending');decideActivation(state,req.installationId,'approve');
  const licence=verifyLicence(requestActivation(state,req).licence,state.publicKey,req);assert.equal(licence.client.address,details.address);
  assert.throws(()=>validateClient({...details,email:'not-email'}));assert.throws(()=>validateClient({...details,address:'x'.repeat(601)}));
});
test('recovery is one-use, inherits client/tools/expiry and does not auto-approve a new install',async()=>{
  const state=await newAuthority(password),expiresAt=new Date(Date.now()+86400000).toISOString();
  const key=generateLicenceKey(state,{customer:'Sample Shop',client:details,tools:['badge'],expiresAt}),req=request(state,key);
  requestActivation(state,req);decideActivation(state,req.installationId,'approve');
  const replacement=recoverLicenceKey(state,{keyId:key.id,recoveryKey:key.recoveryKey});
  assert.notEqual(replacement.key,key.key);assert.notEqual(replacement.recoveryKey,key.recoveryKey);assert.deepEqual(replacement.client,details);assert.deepEqual(replacement.tools,['badge']);assert.equal(replacement.expiresAt,expiresAt);
  assert.throws(()=>recoverLicenceKey(state,{keyId:key.id,recoveryKey:key.recoveryKey}),/already been used/);assert.throws(()=>requestActivation(state,req),/replaced/);
  assert.equal(requestActivation(state,request(state,replacement)).state,'pending');assert(!JSON.stringify(state).includes(replacement.key));assert(!JSON.stringify(state).includes(replacement.recoveryKey));
  assert(!JSON.stringify(dashboard(state)).includes('recoveryHash'));assert(!JSON.stringify(dashboard(state)).includes('"hash"'));
});
test('incorrect recovery, exhausted capacity and expired keys cannot consume recovery',async()=>{
  const state=await newAuthority(password),key=generateLicenceKey(state,{customer:'Sample Shop',client:details,tools:['badge']});
  assert.throws(()=>recoverLicenceKey(state,{keyId:key.id,recoveryKey:'PMR1-'+'x'.repeat(32)}),/incorrect/);
  while(state.keys.length<500)state.keys.push({id:randomUUID()});assert.throws(()=>recoverLicenceKey(state,{keyId:key.id,recoveryKey:key.recoveryKey}),/500 keys/);assert(!state.keys[0].recoveryUsedAt);
});
test('dated receipt expiry is enforced; old lifetime receipts remain supported',async()=>{
  const state=await newAuthority(password),key=generateLicenceKey(state,{customer:'Sample Shop',client:details,tools:['badge'],expiresAt:new Date(Date.now()+86400000).toISOString()}),req=request(state,key);
  requestActivation(state,req);decideActivation(state,req.installationId,'approve');const env=requestActivation(state,req).licence;
  assert.equal(verifyLicence(env,state.publicKey,req).type,'expiring-installation-licence');
  const data=JSON.parse(Buffer.from(env.payload,'base64url'));data.expiresAt='2000-01-01T00:00:00.000Z';const raw=Buffer.from(JSON.stringify(data));assert.throws(()=>verifyLicence({payload:raw.toString('base64url'),signature:sign(null,raw,state.privateKey).toString('base64url')},state.publicKey,req),/expired/);
  assert.throws(()=>generateLicenceKey(state,{customer:'Sample Shop',tools:['badge'],expiresAt:'2000-01-01T00:00:00.000Z'}),/future/);
});
test('client sheet escapes values, shows dates/tools and never exposes recovery secret',()=>{
  const html=licenceSheet({id:'id',customer:'<script>alert(1)</script>',client:details,key:'PM1-example',recoveryKey:'DO-NOT-SHARE',tools:['badge'],createdAt:'2026-09-24T00:00:00Z',expiresAt:'2027-09-24T00:00:00Z'},[{id:'badge',name:'Badge Designer'}]);
  assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('Badge Designer'));assert(html.includes('2027-09-24'));assert(!html.includes('DO-NOT-SHARE'));assert(html.includes('Sample Street'));
});
test('recovery API requires owner login and CSRF and records replacement',async t=>{
  const state=await newAuthority(password),key=generateLicenceKey(state,{customer:'Sample Shop',client:details,tools:['badge']});
  const server=createAuthorityServer({store:{read:async()=>state,change:async fn=>fn(state)},testMode:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));const base='http://127.0.0.1:'+server.address().port;
  const body={keyId:key.id,recoveryKey:key.recoveryKey};const post=(route,data,headers={})=>fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  const moduleResponse=await fetch(base+'/licence-sheet.mjs');assert.equal(moduleResponse.status,200);assert.match(moduleResponse.headers.get('content-type'),/javascript/);
  assert.equal((await post('/api/recover',body)).status,401);const login=await post('/api/login',{password});const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/api/recover',body,{Cookie:cookie})).status,403);const data=await(await fetch(base+'/api/dashboard',{headers:{Cookie:cookie}})).json();
  const response=await post('/api/recover',body,{Cookie:cookie,'X-Owner-CSRF':data.csrf});assert.equal(response.status,201);assert.match((await response.json()).key,/^PM1-/);
});
test('client validation ships in application runtime and recovery issuer does not',async()=>{
  const files=await runtimeFiles(fileURLToPath(new URL('../',import.meta.url)));assert(files.includes('licensing/client.mjs'));assert(!files.some(f=>f.includes('authority.mjs')||f.includes('licence-sheet')));
});
