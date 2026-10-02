import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes, createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {json, readJson, sameOrigin} from '../PrintsMen Badge Studio/licensing/http.mjs';
import {LicenceStore} from '../PrintsMen Badge Studio/licensing/store.mjs';
import {windowsProtection} from '../PrintsMen Badge Studio/licensing/windows.mjs';
import {generateLicenceKey, recoverLicenceKey, requestActivation, decideActivation, confirmActivation, dashboard} from './authority.mjs';
import {authenticateOwner, sessionVersion, securitySummary, beginEnrollment, enableMfa, changeOwnerPassword, audit} from './security.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const hash = token => createHash('sha256').update(token).digest('hex');
export function createAuthorityServer({store, publicOrigin = null, testMode = false, surface = 'local'}) {
  if (!['local','owner','activation'].includes(surface)) throw new Error('Invalid authority surface.');
  if (surface === 'activation' && !publicOrigin && !testMode) throw new Error('Activation hosting requires an HTTPS public origin.');
  if (publicOrigin) {
    const parsed = new URL(publicOrigin);
    if (parsed.protocol !== 'https:' || parsed.origin !== publicOrigin || parsed.username || parsed.password) throw new Error('Public authority must use an HTTPS origin via a reverse proxy.');
    if (surface === 'local') throw new Error('Use the separate activation surface for public hosting.');
  }
  const sessions = new Map(), attempts = new Map();
  const server = http.createServer(async (req,res) => {
    try {
      const localOrigin = 'http://127.0.0.1:' + req.socket.localPort;
      const origin = publicOrigin || localOrigin;
      if (req.headers.host !== new URL(origin).host) return json(res,403,{error:'Unrecognised authority host.'});
      const url = new URL(req.url, origin), now = Date.now();
      const activationRoute = ['/v1/activation/request','/v1/activation/confirm'].includes(url.pathname);
      if ((surface === 'activation' && (!activationRoute || req.method !== 'POST')) || (surface === 'owner' && activationRoute)) return json(res,404,{error:'Not found.'});
      if (surface === 'local' && !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return json(res,403,{error:'Local test surface only.'});
      for (const [key,value] of sessions) if (value.expires < now || value.absolute < now) sessions.delete(key);
      for (const [key,value] of attempts) if (value.until < now) attempts.delete(key);
      function rate(bucket, limit) {
        const key = bucket + ':' + req.socket.remoteAddress;
        const entry = attempts.get(key) || {count:0, until:now+60000};
        if (attempts.size > 10000) throw Object.assign(new Error('Service busy.'),{status:429});
        attempts.set(key,entry);
        if (++entry.count > limit) throw Object.assign(new Error('Too many requests. Wait a minute and try again.'),{status:429});
      }
      const token = req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pm_owner='))?.slice(9) || '';
      const session = sessions.get(hash(token));
      async function owner(write = false) {
        if (!session) throw Object.assign(new Error('Owner sign-in is required.'),{status:401});
        if (write) {
          sameOrigin(req,origin);
          if (req.headers['x-owner-csrf'] !== session.csrf) throw Object.assign(new Error('Reload the dashboard and try again.'),{status:403});
        }
        const state = await store.read();
        checkVersion(state);
        session.expires = now + 30*60*1000;
        return state;
      }
      function checkVersion(state) {
        if (!session || session.version !== sessionVersion(state)) {
          sessions.delete(hash(token));
          throw Object.assign(new Error('Owner security changed. Sign in again.'),{status:401});
        }
      }
      async function ownerChange(update) {
        return store.change(async state => { checkVersion(state); return update(state); });
      }
      async function reauthenticate(state, body) {
        const result = await authenticateOwner(state,body.password,body.code);
        return result.version;
      }
      if (url.pathname === '/api/login' && req.method === 'POST') {
        sameOrigin(req,origin); rate('login',5);
        const body = await readJson(req);
        if (sessions.size >= 100) return json(res,429,{error:'Too many owner sessions.'});
        const authenticated = await store.change(async state => {
          const result = await authenticateOwner(state,body.password,body.code);
          audit(state,'owner.signed-in'); return result;
        });
        const newToken = randomBytes(32).toString('base64url'), csrf = randomBytes(32).toString('hex');
        sessions.delete(hash(token));
        sessions.set(hash(newToken),{csrf,version:authenticated.version,expires:now+30*60*1000,absolute:now+8*60*60*1000});
        res.setHeader('Set-Cookie',`pm_owner=${newToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${publicOrigin ? '; Secure' : ''}`);
        return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/logout' && req.method === 'POST') {
        await owner(true); sessions.delete(hash(token));
        res.setHeader('Set-Cookie',`pm_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${publicOrigin ? '; Secure' : ''}`);
        return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/dashboard' && req.method === 'GET') {
        const state = await owner(); return json(res,200,{...dashboard(state),security:securitySummary(state),csrf:session.csrf,localTest:!publicOrigin || testMode});
      }
      if (url.pathname === '/api/security/enrol/start' && req.method === 'POST') {
        await owner(true); rate('security',5); const body = await readJson(req);
        const version = await ownerChange(state => reauthenticate(state,body));
        session.version = version;
        session.pendingMfa = beginEnrollment();
        return json(res,200,{secret:session.pendingMfa.secret,expiresAt:new Date(session.pendingMfa.expires).toISOString(),issuer:'PrintsMen Owner',account:'Owner',digits:6,period:30});
      }
      if (url.pathname === '/api/security/enrol/confirm' && req.method === 'POST') {
        await owner(true); rate('security-confirm',5); const body = await readJson(req);
        const result = await ownerChange(state => enableMfa(state,session.pendingMfa,body.code));
        sessions.clear(); return json(res,200,{...result,signedOut:true});
      }
      if (url.pathname === '/api/security/enrol/cancel' && req.method === 'POST') {
        await owner(true); delete session.pendingMfa; return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/security/password' && req.method === 'POST') {
        await owner(true); rate('security',5); const body = await readJson(req);
        await ownerChange(async state => {
          await reauthenticate(state,body);
          if (body.newPassword === body.password) throw Object.assign(new Error('Choose a different new password.'),{status:400});
          await changeOwnerPassword(state,body.newPassword);
        });
        sessions.clear(); return json(res,200,{ok:true,signedOut:true});
      }
      if (url.pathname === '/api/keys' && req.method === 'POST') {
        await owner(true); const body = await readJson(req);
        return json(res,201,await ownerChange(state=>{const result=generateLicenceKey(state,body);audit(state,'licence.issued',{target:result.id});return result;}));
      }
      if (url.pathname === '/api/decision' && req.method === 'POST') {
        await owner(true); const body = await readJson(req);
        await ownerChange(state=>{decideActivation(state,body.installationId,body.decision);audit(state,'activation.'+body.decision,{target:body.installationId});});
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/recover'&&req.method==='POST'){
        await owner(true);rate('recovery',10);const body=await readJson(req);
        return json(res,201,await ownerChange(state=>{const result=recoverLicenceKey(state,body);audit(state,'licence.recovered',{target:result.id});return result;}));
      }
      if (url.pathname === '/v1/activation/request' && req.method === 'POST') {
        rate('activation',60);
        if (req.headers.origin) return json(res,403,{error:'Activation must be sent by the installed application server.'});
        const body = await readJson(req);
        return json(res,200,await store.change(state=>{
          if(surface==='activation'&&!state.owner.mfa)throw Object.assign(new Error('Owner security setup is required before public activation.'),{status:503});
          const before=state.requests.length,result=requestActivation(state,body);
          if(state.requests.length>before)audit(state,'activation.requested',{actor:'installation',target:body.installationId});return result;
        }));
      }
      if (url.pathname === '/v1/activation/confirm' && req.method === 'POST') {
        rate('activation',60);
        if (req.headers.origin) return json(res,403,{error:'Confirmation must be sent by the installed application server.'});
        const body = await readJson(req);
        return json(res,200,await store.change(state=>{
          if(surface==='activation'&&!state.owner.mfa)throw Object.assign(new Error('Owner security setup is required before public activation.'),{status:503});
          const before=state.requests.find(item=>item.installationId===body.installationId)?.confirmedAt;
          const result=confirmActivation(state,body);if(!before)audit(state,'activation.confirmed',{actor:'installation',target:body.installationId});return result;
        }));
      }
      const assets = {'/':'index.html','/index.html':'index.html','/dashboard.js':'dashboard.js','/dashboard.css':'dashboard.css','/licence-sheet.mjs':'licence-sheet.mjs','/client-sheet.css':'client-sheet.css'};
      if (req.method === 'GET' && assets[url.pathname]) {
        const file = assets[url.pathname];
        res.writeHead(200,{'Content-Type':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8',
          'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
          'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
        return res.end(await readFile(path.join(root,file)));
      }
      return json(res,404,{error:'Not found.'});
    } catch (error) { json(res,error.status || 400,{error:error.status ? error.message : 'The request could not be completed. Check the input or authority state.'}); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 64;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = new LicenceStore(path.join(root,'private','authority.dpapi'),windowsProtection);
  await store.read().catch(()=>{throw new Error('Owner setup is required. Run node setup.mjs first.');});
  const server = createAuthorityServer({store,surface:'owner'});
  server.listen(Number(process.env.PORT || 4290),'127.0.0.1',()=>console.log('Owner activation dashboard: http://127.0.0.1:'+server.address().port));
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  if(process.env.PRINTSMEN_AUTHORITY_ORIGIN){
    const activation=createAuthorityServer({store,surface:'activation',publicOrigin:process.env.PRINTSMEN_AUTHORITY_ORIGIN});
    activation.listen(Number(process.env.PRINTSMEN_ACTIVATION_PORT||4292),'127.0.0.1',()=>console.log('Activation-only backend: 127.0.0.1:'+activation.address().port+' (HTTPS reverse proxy required)'));
    activation.on('error',error=>{console.error(error.message);server.close();process.exitCode=1;});
  }
}
