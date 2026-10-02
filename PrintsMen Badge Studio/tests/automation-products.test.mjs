import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {millimetres,planJob,validatePlan,jobRoute,TOOL_ROUTES} from '../automation-core.js';
import {documentName,uploadName,outputName} from '../naming.js';
import {productSettings,productGeometry,productSheet,productSVG,shapePoints,artworkPlacement,productProject} from '../products-core.js';
import {productPDF,sheetSides} from '../product-pdf.js';
import {LIMITS} from '../files.js';
import {createStudioServer} from '../studio-server.mjs';
import {runtimeFiles} from '../scripts/release-files.mjs';
import {UpdateManager} from '../updates/manager.mjs';

const settings=patch=>productSettings({mode:'tray',unit:'mm',w:80,h:120,d:30,tab:12,bleed:3,safe:3,...patch});
const sheet={w:210,h:297,copies:7,margin:5,gap:4};
const image=readFileSync(new URL('fixtures/background-holes.png',import.meta.url));
const pdfLib={};
new vm.Script('(function(exports,module){'+readFileSync(new URL('../vendor/pdf-lib/pdf-lib.min.js',import.meta.url),'utf8')+'\n})').runInThisContext()(pdfLib,{});

test('offline planner uses explicit units, quantities and exact supported presets',()=>{
  assert.equal(millimetres(2,'in'),50.8);assert.equal(millimetres(.5,'feet'),152.4);assert.equal(millimetres(3,'cm'),30);
  for(const n of ['',0,-2,NaN,Infinity,true])assert.throws(()=>millimetres(n));
  const plan=planJob('100 round badges 58 mm on A4');assert.deepEqual(plan.missing,[]);assert.equal(plan.copies,100);assert.equal(plan.preset,'round58');assert.deepEqual(plan.paperSize,[210,297]);
  assert.deepEqual(planJob('4 boxes 8 x 12 x 3 cm on 13x19').size,{w:80,h:120,d:30});
  assert.deepEqual(planJob('dangler 13 x 19 mm on A4').size,{w:13,h:19});
  assert.deepEqual(planJob('dangler 12 x 18 mm on 13 x 19 inches').paperSize,[330.2,482.6]);
  for(const prompt of ['round badge 57 mm','box 80 x 120 mm','box -80 x 120 x 30 mm','box 80 x 120 x 30','501 copies dangler 50 x 50 mm','boxes 80 x 120 x 30 mm on A4 and A3'])assert(planJob(prompt).missing.length,prompt);
  assert.equal(validatePlan({...plan,copies:9999,preset:'invented'}).copies,100);
});

test('assistant routes cover every legacy production page with manual review',()=>{
  assert.equal(TOOL_ROUTES.length,20);assert.equal(new Set(TOOL_ROUTES.map(t=>t.page)).size,20);
  for(const t of TOOL_ROUTES)assert.equal(jobRoute({tool:t.id}),'printsmen/index.html#'+t.page);
  assert.equal(jobRoute(planJob('mockup')),'products.html?studio=mockup');assert.equal(jobRoute(planJob('dangler 50 x 70 mm')),'products.html?studio=dangler');assert.throws(()=>jobRoute({tool:'../../secret'}));
});

test('output names retain source identity and protect Windows filenames',()=>{
  assert.equal(documentName('C:\\jobs\\Client logo.pdf / 2'),'Client logo');
  assert.equal(documentName('CON.png'),'artwork_CON');assert.equal(documentName('a:b?.jpg'),'a_b_');
  assert.equal(uploadName([{name:'Client photo.jpg'},{name:'Second.png'}]),'Client photo_batch');
  assert.equal(outputName('Client.pdf',{tool:'dangler',page:2}),'Client_dangler_page-002.pdf');
  assert.throws(()=>outputName('x',{extension:'../../exe'}));
});

test('tray and sleeve unfold to exact millimetres with cut and fold edges',()=>{
  const tray=productGeometry(settings());assert.equal(tray.w,146);assert.equal(tray.h,186);assert.equal(tray.faces.length,9);
  assert(tray.lines.some(l=>l.kind==='cut'));assert(tray.lines.some(l=>l.kind==='fold'));
  const sleeve=productGeometry(settings({mode:'sleeve'}));assert.equal(sleeve.w,238);assert.equal(sleeve.h,126);
  assert.equal(sleeve.lines.filter(l=>l.kind==='fold').length,4);
  const fractional=productGeometry(settings({w:80.125,h:120.375,d:30.2,tab:12.3,bleed:2.7}));
  const keys=fractional.lines.map(l=>JSON.stringify([l.x1,l.y1,l.x2,l.y2].map(n=>Math.round(n*1e6))));assert.equal(new Set(keys).size,keys.length);
  assert.throws(()=>productGeometry(settings({w:980})),/1000/);
  assert.throws(()=>productGeometry(settings({mode:'dangler',w:999,h:10,hole:0})),/1000/);
});

test('dangler shapes use full requested bounds and holes cannot cross cuts',()=>{
  for(const shape of ['rect','round','heart','polygon'])for(const sides of [3,5,6,16]){
    const points=shapePoints(shape,80,120,sides),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    assert(Math.abs(Math.max(...xs)-Math.min(...xs)-80)<1e-6);assert(Math.abs(Math.max(...ys)-Math.min(...ys)-120)<1e-6);
  }
  assert.throws(()=>settings({mode:'dangler',shape:'round'}),/equal/);
  assert.throws(()=>productGeometry(settings({mode:'dangler',hole:8,holeY:2})),/hole/);
  const g=productGeometry(settings({mode:'dangler',shape:'round',w:60,h:60,hole:3}));assert.equal(g.hole.r,1.5);
});

test('all output papers keep exact dimensions and copies without overlap',()=>{
  const g=productGeometry(settings({mode:'dangler',w:40,h:60,hole:0}));
  for(const [w,h] of [[210,297],[297,420],[304.8,457.2],[330.2,457.2],[330.2,482.6],[173.25,268.75]])for(const [W,H] of [[w,h],[h,w]]){
    const sheets=productSheet(g,{...sheet,w:W,h:H,copies:500});assert.equal(sheets.flat().length,500);
    for(const list of sheets)for(let i=0;i<list.length;i++){
      const p=list[i];assert.equal(p.w,g.w);assert.equal(p.h,g.h);assert(p.x>=5&&p.y>=5&&p.x+p.w<=W-5+1e-6&&p.y+p.h<=H-5+1e-6);
      for(const q of list.slice(i+1))assert(p.x+p.w+4<=q.x+1e-6||q.x+q.w+4<=p.x+1e-6||p.y+p.h+4<=q.y+1e-6||q.y+q.h+4<=p.y+1e-6);
    }
  }
  for(const copies of [0,501,1.5])assert.throws(()=>productSheet(g,{...sheet,copies}));
  assert.throws(()=>productSheet(productGeometry(settings()),{...sheet,w:100,h:100}));
});

test('preview-only guides and labels never leak into unmarked output',()=>{
  const g=productGeometry(settings()),plain=productSVG(g,{guides:false});assert.match(plain,/width="146mm" height="186mm"/);
  assert.doesNotMatch(plain,/<text|<line|#236d36/);assert.match(productSVG(g,{safeGuides:true}),/#236d36/);
  const f=g.faces[0],a={w:1200,h:600};const fit=artworkPlacement(f,a,{fit:'contain'});assert.equal(fit.w,80);assert.equal(fit.h,40);
  assert.throws(()=>artworkPlacement(f,a,{zoom:0}));assert.throws(()=>productSVG(g,{art:{base:{...a,data:'https://external.test/photo.png'}}}));
});

test('duplex mirrors placements, not artwork, and projects restore valid paper settings',()=>{
  const s=settings({mode:'dangler',w:40,h:60,hole:0}),g=productGeometry(s),layout=sheetSides(g,sheet,true);
  assert.equal(layout.length,2);for(let i=0;i<7;i++)assert.equal(layout[1].items[i].x,210-layout[0].items[i].x-g.w);
  const raw={schema:1,type:'printsmen-product',settings:s,background:'#ffffff',assets:[],art:{},paper:{paperW:330.2,paperH:482.6,productCopies:12,productMargin:6,productGap:8,duplex:true}};
  const next=productProject(raw,LIMITS);assert.equal(next.paper.productCopies,12);assert.equal(next.paper.paperW,330.2);assert.equal(next.paper.duplex,true);
  assert.throws(()=>productProject({...raw,paper:{productCopies:-1}},LIMITS));assert.throws(()=>productProject({...raw,art:{unknown:{assetId:'x'}}},LIMITS));
});

test('real PDF bytes retain exact media boxes, copies, front/back and cancellation',async()=>{
  const g=productGeometry(settings({mode:'dangler',w:40,h:60,hole:0}));let calls=[];
  const bytes=await productPDF(g,sheet,{pdfLib,duplex:true,rasterize:async side=>{calls.push(side);return new Uint8Array(image);}});
  const document=await pdfLib.PDFDocument.load(bytes);assert.equal(document.getPageCount(),2);assert.deepEqual(calls,['front','back']);
  for(const p of document.getPages()){assert(Math.abs(p.getWidth()-210*72/25.4)<1e-7);assert(Math.abs(p.getHeight()-297*72/25.4)<1e-7);}
  const controller=new AbortController();controller.abort();await assert.rejects(()=>productPDF(g,sheet,{pdfLib,signal:controller.signal,rasterize:()=>{throw new Error('Should not render');}}),/abort/i);
});

test('new product workspace ships, respects licences and blocks idle updates',async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),files=await runtimeFiles(root);
  for(const name of ['products.html','products.js','products-core.js','product-pdf.js','assistant.js','automation-core.js','naming.js','legacy-photo-framing.js'])assert(files.includes(name));
  const manager=new UpdateManager({root,config:{schema:1,channel:'preview',feedUrl:'',publicKey:''},version:'0.9.0',cache:root,now:()=>1000});
  manager.openClient('products.html');assert.equal(manager.status().openEditors,1);assert.equal(manager.isIdle(),false);
  const server=createStudioServer({root,gate:{status:()=>({mode:'managed',active:true,tools:['printsmen.standard']})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const origin='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(origin+'/products.html')).status,403);
  for(const name of ['assistant.js','automation-core.js','core.js','naming.js','faces.js','face-worker.js','legacy-photo-framing.js'])assert.equal((await fetch(origin+'/'+name)).status,200);
  const home=await (await fetch(origin+'/index.html')).text();
  assert.match(home,/article\.card:has\(a\[href\^="products\.html"\]\)/);
  for(const studio of ['box','dangler','mockup'])assert.match(home,new RegExp('products\\.html\\?studio='+studio));
});

test('product output reports real stages and cancellation stops before rasterisation',async()=>{
  const g=productGeometry(settings({mode:'dangler',w:40,h:60,hole:0})),events=[];
  await productPDF(g,sheet,{pdfLib,rasterize:async()=>new Uint8Array(image),progress:(value,message)=>events.push({value,message})});
  assert.equal(events[0].value,null);assert.match(events[0].message,/Rendering front/);
  assert(events.some(e=>e.value===1&&/Building sheet/.test(e.message)));
  assert.equal(events.at(-1).value,null);assert.match(events.at(-1).message,/Finalising PDF/);
  const controller=new AbortController();let rendered=false;
  await assert.rejects(()=>productPDF(g,sheet,{pdfLib,signal:controller.signal,progress:()=>controller.abort(),rasterize:async()=>{rendered=true;return new Uint8Array(image);}}),/abort/i);
  assert.equal(rendered,false);
});
