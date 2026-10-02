import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID, generateKeyPairSync, randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';
import {newAuthority, checkPassword, generateLicenceKey, requestActivation, recoverLicenceKey} from '../../PrintsMen Licence Manager/authority.mjs';
import {createAuthorityServer} from '../../PrintsMen Licence Manager/server.mjs';
import {encodeBase32, totp, consumeFactor, beginEnrollment, enableMfa, authenticateOwner, securitySummary, audit} from '../../PrintsMen Licence Manager/security.mjs';
import {encryptBackup, decryptBackup, restoreBackup, backupSummary} from '../../PrintsMen Licence Manager/backup.mjs';
import {LicenceStore} from '../licensing/store.mjs';
import {authorityFingerprint, PRODUCT} from '../licensing/licence.mjs';

const password = 'Test-owner-password-only-123456';
const passphrase = 'Backup-test-passphrase-separate-123456';
const testRoot = fileURLToPath(new URL('../test-output/owner-security/',import.meta.url));
await mkdir(testRoot,{recursive:true});
function protection() {
  const key = randomBytes(32);
  return {
    async protect(text) { const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(text,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64'); },
    async unprotect(text) { const raw=Buffer.from(text,'base64'),cipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));cipher.setAuthTag(raw.subarray(-16));return Buffer.concat([cipher.update(raw.subarray(12,-16)),cipher.final()]).toString('utf8'); },
  };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(testRoot,'case-'));
  t.after(async()=>{assert(path.resolve(root).startsWith(path.resolve(testRoot)+path.sep));await rm(root,{recursive:true,force:true});});
  const state = await newAuthority(password), store = new LicenceStore(path.join(root,'authority.dpapi'),protection());
  await store.change(value=>Object.assign(value,state),{allowNew:true});
  return {root,state,store};
}
async function listen(t,options) {
  const server=createAuthorityServer(options);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(route,body,{cookie,csrf,origin=base}={}) {
    const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(csrf?{'X-Owner-CSRF':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {response,value:await response.json()};
  }
  async function login(code) {
    const result=await call('/api/login',{password,code});
    assert.equal(result.response.status,200,JSON.stringify(result.value));
    const cookie=result.response.headers.get('set-cookie').split(';')[0];
    const {value}=await call('/api/dashboard',undefined,{cookie});return {cookie,csrf:value.csrf};
  }
  return {base,call,login};
}

test('TOTP agrees with RFC 6238 SHA-1 vectors, including time after 2038',()=>{
  const secret=encodeBase32(Buffer.from('12345678901234567890'));
  for(const [seconds,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(totp(secret,Math.floor(seconds/30),8),expected);
});

test('MFA enrollment needs confirmation, expires and rejects replay and old codes',async()=>{
  const state=await newAuthority(password),now=1_800_000_000_000,pending=beginEnrollment(now);
  assert(!state.owner.mfa);
  assert.throws(()=>enableMfa(state,pending,'xxxxxx',now),/six-digit/);
  assert.throws(()=>enableMfa(state,pending,totp(pending.secret,Math.floor(now/30000)),now+300000),/expired/);
  const result=enableMfa(state,pending,totp(pending.secret,Math.floor(now/30000)),now);
  assert.equal(result.recoveryCodes.length,10);assert.equal(new Set(result.recoveryCodes).size,10);
  assert.throws(()=>consumeFactor(state,totp(pending.secret,Math.floor(now/30000)),now),/already used/);
  assert.throws(()=>consumeFactor(state,totp(pending.secret,Math.floor(now/30000)-3),now+30000),/incorrect/);
  assert.equal(consumeFactor(state,totp(pending.secret,Math.floor(now/30000)+1),now+30000),'authenticator');
  assert.equal(consumeFactor(state,result.recoveryCodes[0],now),'recovery-code');
  assert.throws(()=>consumeFactor(state,result.recoveryCodes[0],now),/incorrect/);
  assert.equal(securitySummary(state).recoveryCodesRemaining,9);
  assert(!JSON.stringify(state).includes(result.recoveryCodes[0]));
  assert(!JSON.stringify(securitySummary(state)).includes(pending.secret));
});

test('concurrent owner recovery logins consume one code exactly once',async t=>{
  const f=await fixture(t),now=Date.now(),pending=beginEnrollment(now);
  const result=await f.store.change(state=>enableMfa(state,pending,totp(pending.secret,Math.floor(now/30000)),now));
  const other=new LicenceStore(f.store.file,f.store.protection);
  const outcomes=await Promise.allSettled([f.store,other].map(store=>store.change(state=>authenticateOwner(state,password,result.recoveryCodes[0]))));
  assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);
  assert.equal((await f.store.read()).owner.mfa.recoveryHashes.length,9);
  await assert.rejects(()=>f.store.change(state=>authenticateOwner(state,'wrong',result.recoveryCodes[1])),/credentials/);
  assert.equal((await f.store.read()).owner.mfa.recoveryHashes.length,9);
});

test('owner MFA HTTP flow enforces CSRF, hides secrets, invalidates sessions and supports recovery',async t=>{
  const f=await fixture(t),web=await listen(t,{store:f.store,surface:'owner'}),auth=await web.login();
  const second=await web.login();
  assert.equal((await web.call('/api/security/enrol/start',{password},{cookie:auth.cookie})).response.status,403);
  const start=await web.call('/api/security/enrol/start',{password},auth);assert.equal(start.response.status,200);
  const dash=await web.call('/api/dashboard',undefined,auth);assert(!JSON.stringify(dash.value).includes(start.value.secret));
  const confirm=await web.call('/api/security/enrol/confirm',{code:totp(start.value.secret,Math.floor(Date.now()/30000))},auth);
  assert.equal(confirm.response.status,200);assert.equal(confirm.value.recoveryCodes.length,10);
  assert.equal((await web.call('/api/dashboard',undefined,second)).response.status,401);
  assert.equal((await web.call('/api/login',{password})).response.status,401);
  const recovered=await web.login(confirm.value.recoveryCodes[0]);
  const again=await web.call('/api/login',{password,code:confirm.value.recoveryCodes[0]});assert.equal(again.response.status,401);
  assert.equal((await web.call('/api/dashboard',undefined,recovered)).value.security.recoveryCodesRemaining,9);
  assert.equal((await web.call('/api/login',{password,code:confirm.value.recoveryCodes[1]})).response.status,429);
  const restarted=await listen(t,{store:new LicenceStore(f.store.file,f.store.protection),surface:'owner'});
  const newer=await restarted.login(confirm.value.recoveryCodes[1]);
  assert.equal((await web.call('/api/dashboard',undefined,recovered)).response.status,401);
  assert.equal((await restarted.call('/api/dashboard',undefined,newer)).response.status,200);
});

test('password change rejects weak values and revokes sessions across server instances',async t=>{
  const f=await fixture(t),web=await listen(t,{store:f.store,surface:'owner'}),second=await listen(t,{store:new LicenceStore(f.store.file,f.store.protection),surface:'owner'});
  const auth=await web.login(),old=await second.login();
  assert.equal((await web.call('/api/security/password',{password,newPassword:'tiny'},auth)).response.status,400);
  assert(await checkPassword(await f.store.read(),password));
  const changed=await web.call('/api/security/password',{password,newPassword:'Replacement-owner-password-123456'},auth);assert.equal(changed.response.status,200);
  assert.equal((await second.call('/api/dashboard',undefined,old)).response.status,401);
  assert.equal((await web.call('/api/login',{password})).response.status,401);
  assert.equal((await web.call('/api/login',{password:'Replacement-owner-password-123456'})).response.status,200);
});

test('public activation surface never exposes owner routes/assets or serves an unprotected authority',async t=>{
  const f=await fixture(t),web=await listen(t,{store:f.store,surface:'activation',testMode:true});
  assert.throws(()=>createAuthorityServer({store:f.store,surface:'activation'}),/HTTPS/);
  assert.throws(()=>createAuthorityServer({store:f.store,publicOrigin:'https://example.test'}),/separate/);
  for(const route of ['/','/index.html','/dashboard.js','/api/dashboard','/api/login','/api/keys','/api/security/enrol/start','/private/authority.dpapi','/backup-tool.mjs']){
    assert.equal((await fetch(web.base+route)).status,404);
    assert.equal((await web.call(route,{})).response.status,404);
  }
  assert.equal((await fetch(web.base+'/v1/activation/request',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
  const pending=beginEnrollment(),code=totp(pending.secret,Math.floor(Date.now()/30000));
  await f.store.change(state=>enableMfa(state,pending,code));
  const key=await f.store.change(state=>generateLicenceKey(state,{customer:'Test client',tools:['badge']}));
  const req={schema:1,type:'activation-request',product:PRODUCT,installationId:randomUUID(),machineHash:'a'.repeat(64),authorityFingerprint:authorityFingerprint(f.state.publicKey),challenge:'b'.repeat(64),licenceKey:key.key};
  const response=await fetch(web.base+'/v1/activation/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});
  assert.equal(response.status,200);assert.equal((await response.json()).state,'pending');
  assert.equal((await web.call('/v1/activation/request',req)).response.status,403);
  const owner=await listen(t,{store:f.store,surface:'owner'});
  assert.equal((await owner.call('/v1/activation/request',req)).response.status,404);
});

test('encrypted portable backup restores both signing identities under different account protection',async t=>{
  const f=await fixture(t),key=generateLicenceKey(f.state,{customer:'Backup client',tools:['badge']}),pending=beginEnrollment();
  enableMfa(f.state,pending,totp(pending.secret,Math.floor(Date.now()/30000)));
  const pair=generateKeyPairSync('ed25519'),updates={schema:1,product:PRODUCT,retired:[],current:null,updateSigning:{privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),publicKey:pair.publicKey.export({type:'spki',format:'pem'})}};
  const encrypted=await encryptBackup({authority:f.state,updates},passphrase);
  const text=JSON.stringify(encrypted);assert(!text.includes('Backup client'));assert(!text.includes(f.state.privateKey));assert(!text.includes(pending.secret));
  const restored=await decryptBackup(encrypted,passphrase);assert.equal(backupSummary(restored).updateSigningIncluded,true);
  const different=protection(),destination=path.join(f.root,'new-private');
  await restoreBackup(restored,destination,different,{newOwnerPassword:'Restored-owner-password-123456'});
  const newState=await new LicenceStore(path.join(destination,'authority.dpapi'),different).read();
  assert.equal(newState.publicKey,f.state.publicKey);assert.equal(newState.keys[0].id,key.id);assert(!newState.owner.mfa);
  assert(await checkPassword(newState,'Restored-owner-password-123456'));assert(!await checkPassword(newState,password));
  const restoredUpdates=await new LicenceStore(path.join(destination,'update-signing.dpapi'),different).read();assert.equal(restoredUpdates.updateSigning.publicKey,updates.updateSigning.publicKey);
  await assert.rejects(()=>new LicenceStore(path.join(destination,'authority.dpapi'),f.store.protection).read());
  await assert.rejects(()=>restoreBackup(restored,destination,different),/EEXIST/);
  assert.equal((await new LicenceStore(path.join(destination,'authority.dpapi'),different).read()).publicKey,f.state.publicKey);
});

test('backup rejects wrong password, tampering, excessive KDF and failed restore leaves no destination',async t=>{
  const f=await fixture(t),encrypted=await encryptBackup({authority:f.state},passphrase);
  await assert.rejects(()=>decryptBackup(encrypted,'Wrong-backup-password-123456'),/incorrect/);
  const raw=Buffer.from(encrypted.ciphertext,'base64');raw[0]^=1;
  await assert.rejects(()=>decryptBackup({...encrypted,ciphertext:raw.toString('base64')},passphrase),/damaged/);
  await assert.rejects(()=>decryptBackup({...encrypted,kdf:{...encrypted.kdf,N:2**30}},passphrase),/Unsupported/);
  await assert.rejects(()=>encryptBackup({authority:f.state},'short'),/16-256/);
  const payload=await decryptBackup(encrypted,passphrase),destination=path.join(f.root,'failed');
  await assert.rejects(()=>restoreBackup(payload,destination,{protect:async()=>{throw Error('DPAPI unavailable');}}),/DPAPI/);
  assert(!(await readdir(f.root)).includes('failed'));
});

test('concurrent client reinstall recovery keeps one replacement and audits remain bounded',async t=>{
  const f=await fixture(t),key=await f.store.change(state=>generateLicenceKey(state,{customer:'Race test',tools:['badge']}));
  const outcomes=await Promise.allSettled([f.store,f.store].map(store=>store.change(state=>recoverLicenceKey(state,{keyId:key.id,recoveryKey:key.recoveryKey}))));
  assert.equal(outcomes.filter(value=>value.status==='fulfilled').length,1);assert.equal((await f.store.read()).keys.length,2);
  const state=await f.store.read();for(let i=0;i<510;i++)audit(state,'test.event');
  assert.equal(state.audit.length,500);assert.equal(state.auditDropped,10);
});
