import http from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomBytes} from 'node:crypto';
import {PRODUCT} from './licensing/licence.mjs';
import {TOOL_CATALOG} from './licensing/catalog.mjs';
import {json, readJson, sameOrigin} from './licensing/http.mjs';

const publicFiles = new Set(['activation.html','activation.css','activation.js','login.html','login.js']);
const runtimeFiles = new Set(['index.html','dashboard.html','dashboard.css','dashboard.js','badge.html','badge-sizes.html','app.js','catalogue.js','core.js','render.js','files.js','fonts.js','storage.js','production-runtime.mjs',
  'crop.js','export.js','print-plan.js','packing.js','photo.js','photo-editor.js','faces.js','face-worker.js','legacy-photo-framing.js','style.css','editor.css','badge-theme.css','session.js','updates.html','updates.js','updates.css','updates-client.js',
  'assistant.js','assistant.css','automation-core.js','naming.js','products.html','products.js','products.css','products-core.js','product-pdf.js']);
const sharedFiles=new Set(['index.html','dashboard.html','dashboard.css','dashboard.js','session.js','assistant.js','assistant.css','automation-core.js','naming.js','core.js','faces.js','face-worker.js','legacy-photo-framing.js']);
const updateFiles=new Set(['updates.html','updates.js','updates.css','updates-client.js']);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml',
  '.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
export const rootId = root => createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,24);

export function createStudioServer({root, gate = null, activation = null, configurationError = '', operatorAuth = null, edition = 'development', updates=null}) {
  const csrf = randomBytes(32).toString('hex');
  const status = () => configurationError ? {mode:'managed', state:'invalid', active:false, message:configurationError} : gate ? gate.status() : edition === 'preview' ?
    {mode:'preview',state:'preview',active:true,message:'LOCAL PREVIEW: all tools enabled for testing. Production licensing and online activation are not enabled.'} :
    {mode:'development', state:'development', active:true, message:'Unlicensed development copy. Managed installations require online owner approval.'};
  const server = http.createServer(async (req, res) => {
    try {
      const port = req.socket.localPort;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) return json(res, 403, {error:'Local host access only.'});
      const origin = 'http://' + req.headers.host;
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/studio/status' && req.method === 'GET') {
        return json(res, 200, {product:PRODUCT, version:updates?.version||null, rootId:rootId(root), licence:await status(), authentication:operatorAuth?.status(req)||{required:false,loggedIn:false},onlineActivation:!!activation, tools:TOOL_CATALOG, csrf});
      }
      if (url.pathname === '/api/session/login' && req.method === 'POST') {
        sameOrigin(req,origin);
        if(!operatorAuth)return json(res,503,{error:'Operator sign-in is not configured.'});
        return json(res,200,await operatorAuth.login(req,res,await readJson(req)));
      }
      if (url.pathname === '/api/session/logout' && req.method === 'POST') {
        sameOrigin(req,origin);
        if(req.headers['x-studio-csrf']!==csrf)return json(res,403,{error:'Invalid session request.'});
        operatorAuth?.logout(req,res);return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/studio/shutdown' && req.method === 'POST') {
        sameOrigin(req, origin);
        if (req.headers['x-studio-csrf'] !== csrf) return json(res, 403, {error:'Reload the local status before stopping this server.'});
        if (activation?.busy) return json(res, 409, {error:'Activation is in progress. Wait for it to finish before uninstalling.'});
        json(res,200,{stopping:true});
        setImmediate(()=>server.close());
        return;
      }
      if(url.pathname.startsWith('/api/updates/')){
        if(operatorAuth&&!operatorAuth.status(req).loggedIn)return json(res,401,{error:'Sign in to use Update Manager.'});
        if(!updates)return json(res,503,{error:'Update configuration is unavailable. Contact the owner.'});
        const action=url.pathname.slice('/api/updates/'.length);
        if(action==='status'&&req.method==='GET')return json(res,200,updates.status());
        if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
        sameOrigin(req,origin);const body=await readJson(req);
        if((req.headers['x-studio-csrf']||body.csrf)!==csrf)return json(res,403,{error:'Reload Update Manager and try again.'});
        if(action==='heartbeat')return json(res,updates.heartbeat(body)?200:409,{version:updates.version});
        if(action==='check')return json(res,200,await updates.check());
        if(action==='download')return json(res,200,await updates.download());
        if(action==='install'){
          if(body.savedWork!==true)return json(res,400,{error:'Confirm that all jobs are saved before installing.'});
          return json(res,200,await updates.install({manual:true}));
        }
        return json(res,404,{error:'Unknown update action.'});
      }
      if (url.pathname === '/api/licence/activate' && req.method === 'POST') {
        sameOrigin(req, origin);
        if(operatorAuth&&!operatorAuth.status(req).loggedIn)return json(res,401,{error:'Sign in before activating.'});
        if (req.headers['x-studio-csrf'] !== csrf) return json(res, 403, {error:'Reload the activation page and try again.'});
        if (!activation) return json(res, 503, {error:'Online activation has not been configured by the owner.'});
        const body = await readJson(req);
        if (typeof body.customer !== 'string' || !body.customer.trim() || body.customer.trim().length > 120) return json(res, 400, {error:'Enter a shop/operator name (1-120 characters).'});
        if (typeof body.licenceKey !== 'string' || !/^PM1-[A-Za-z0-9_-]{32}$/.test(body.licenceKey)) return json(res, 400, {error:'Enter a valid owner-issued licence key.'});
        return json(res, 200, await activation.activate(body.customer.trim(), body.licenceKey, body.client));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, {error:'Method not allowed.'});
      let relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      if (relative.includes('\\') || relative.split('/').some(part => !part || part.startsWith('.'))) return json(res, 403, {error:'Forbidden path.'});
      if (!publicFiles.has(relative) && !runtimeFiles.has(relative) && !relative.startsWith('vendor/') && !relative.startsWith('printsmen/')) {
        return json(res, 404, {error:'Not found.'});
      }
      if(!publicFiles.has(relative)&&operatorAuth&&!operatorAuth.status(req).loggedIn){
        if(relative.endsWith('.html')){res.writeHead(303,{Location:relative==='updates.html'?'/login.html?next=updates':relative==='dashboard.html'?'/login.html?next=dashboard':'/login.html','Cache-Control':'no-store'});return res.end();}
        return json(res,401,{error:'Operator sign-in is required.'});
      }
      const licence = await status();
      if (!publicFiles.has(relative) && !updateFiles.has(relative) && !licence.active) {
        if (relative.endsWith('.html')) { res.writeHead(303, {Location:'/activation.html','Cache-Control':'no-store'}); return res.end(); }
        return json(res, 403, {error:'Activation is required.'});
      }
      if (licence.mode === 'managed' && licence.active && !publicFiles.has(relative) && !updateFiles.has(relative) && !sharedFiles.has(relative)) {
        const isPrintsmen = relative.startsWith('printsmen/');
        if ((isPrintsmen && !licence.tools.some(id => id.startsWith('printsmen.'))) || (!isPrintsmen && !licence.tools.includes('badge'))) {
          return json(res, 403, {error:'This workspace is not included in your licence.'});
        }
      }
      const file = await realpath(path.join(root, relative));
      const actualRoot = await realpath(root);
      if (!file.startsWith(actualRoot + path.sep)) return json(res, 403, {error:'Forbidden path.'});
      let bytes = await readFile(file);
      if(relative==='index.html'&&licence.mode==='preview')bytes=Buffer.from(bytes.toString('utf8').replace('<main>','<main><p class="note"><strong>LOCAL PREVIEW</strong> - All tools are enabled for testing after operator sign-in. Online licensing is not enabled. This is not a secured commercial release.</p>'));
      if (relative === 'index.html' && licence.mode === 'managed' && licence.active) {
        const selectors=[];
        if(!licence.tools.includes('badge'))selectors.push('article.card:has(a[href="badge.html"])','article.card:has(a[href^="products.html"])');
        if(!licence.tools.some(id=>id.startsWith('printsmen.')))selectors.push('article.card:has(a[href="printsmen/index.html"])');
        if(selectors.length)bytes=Buffer.from(bytes.toString('utf8').replace(/<head>/i,'<head><style>'+selectors.join(',')+'{display:none}</style>'));
      }
      if (relative === 'printsmen/index.html' && licence.mode === 'managed') {
        const pages = TOOL_CATALOG.filter(tool => licence.tools.includes(tool.id) && tool.page).map(tool => tool.page);
        const blocked = TOOL_CATALOG.filter(tool => tool.page && !pages.includes(tool.page));
        const css = blocked.flatMap(tool => ['#'+tool.page, '[data-page="'+tool.page+'"]','[data-jump="'+tool.page+'"]']).join(',');
        const restriction = '<script>window.PRINTSMEN_ALLOWED_PAGES=Object.freeze('+JSON.stringify(pages)+');</script>' +
          (css ? '<style>'+css+'{display:none!important;pointer-events:none!important}</style>' : '');
        bytes = Buffer.from(bytes.toString('utf8').replace(/<head>/i, '<head>'+restriction));
      }
      if(updates&&req.method==='GET'&&['index.html','dashboard.html','badge.html','products.html','printsmen/index.html','updates.html'].includes(relative)){
        const client=updates.openClient(relative);
        bytes=Buffer.from(bytes.toString('utf8').replace(/<\/body>/i,`<script src="/updates-client.js" data-client="${client}" data-version="${updates.version}" data-csrf="${csrf}"></script></body>`));
      }
      const headers = {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
      if (publicFiles.has(relative)) headers['Content-Security-Policy'] = "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) { json(res, error.status || (error.code === 'ENOENT' ? 404 : 400), {error:error.code === 'ENOENT' ? 'Not found.' : error.message}); }
  });
  server.requestTimeout=15000;
  server.on('listening',()=>updates?.start());
  server.on('close',()=>updates?.close());
  return server;
}
