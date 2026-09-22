import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {frameCrop,framingValues,faceCrop,scaleBorders} from '../photo.js';
import {pack} from '../packing.js';
import {newPage,PRESETS,newProject,makeObject} from '../core.js';
import {validateProject} from '../files.js';
import {imageMarkup,pageSVG} from '../render.js';

test('photo zoom preserves frame aspect and clamps positions',()=>{
  for(const [iw,ih] of [[800,1200],[1200,800]])for(const ratio of [.6,1,2])for(const zoom of [100,200,600])for(const pos of [-100,0,100]){
    const c=frameCrop(iw,ih,ratio,zoom,pos,-pos);assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=1+1e-9&&c.y+c.h<=1+1e-9);assert.ok(Math.abs(c.w*iw/(c.h*ih)-ratio)<1e-8);
    assert.ok(Math.abs(framingValues(c,iw,ih,ratio).zoom-zoom)<1e-8);
  }
  assert.throws(()=>frameCrop(100,100,1,601));
});
test('face crop bounds, empty result and impossible group crop',()=>{
  assert.equal(faceCrop([],800,800,1),null);
  const f={x:250,y:50,w:100,h:100},c=faceCrop([f],800,800,.75);assert.ok(c.x>=0&&c.y>=0&&c.x+c.w<=1&&c.y+c.h<=1);assert.ok(c.x*800<=f.x&&(c.x+c.w)*800>=f.x+f.w);
  assert.equal(faceCrop([{x:0,y:0,w:100,h:100},{x:700,y:0,w:100,h:100}],800,800,.2),null);
});
test('non-destructive rotation and options survive project validation',()=>{
  const p=newProject(),o=makeObject('image',p.pages[0]);p.assets.test={data:'data:image/png;base64,AA==',w:200,h:100};o.asset='test';o.photoRotation=90;o.scaleBorders=true;o.qrCaption=true;p.pages[0].objects.push(o);
  const q=validateProject(p),r=q.pages[0].objects[0];assert.equal(r.photoRotation,90);assert.equal(r.scaleBorders,true);assert.equal(r.qrCaption,true);assert.ok(imageMarkup(r,q.assets[r.asset]).includes('viewBox="0 0 100 200"'));assert.ok(imageMarkup(r,q.assets[r.asset]).includes('rotate(90)'));
  o.photoRotation=45;assert.throws(()=>validateProject(p));
});
test('border scaling is optional and bounded',()=>{
  const before={w:10,h:20,strokeWidth:2,radius:4,scaleBorders:true},o={...before};scaleBorders(o,before,20,40);assert.equal(o.strokeWidth,4);assert.equal(o.radius,8);scaleBorders(o,before,2000,4000);assert.equal(o.strokeWidth,20);const fixed={...before,scaleBorders:false};scaleBorders(fixed,fixed,20,40);assert.equal(fixed.strokeWidth,2);
});
test('smart packing rotates a card that otherwise cannot fit',()=>{
  const p=newPage(PRESETS.find(p=>p.id==='polaroid'));p.copies=2;assert.throws(()=>pack([p],100,70,5,2,false));const sheets=pack([p],100,70,5,2,true);assert.equal(sheets.length,2);assert.ok(sheets.flat().every(p=>p.rotated&&p.w===90&&p.h===60));
});
test('500 mixed-size smart placements preserve dimensions, gaps and bounds',()=>{
  const pages=PRESETS.map((b,i)=>({...newPage(b),copies:i?31:35}));
  for(const rotate of [false,true]){
    const sheets=pack(pages,330.2,482.6,5,2,rotate);assert.equal(sheets.flat().length,500);
    for(const sheet of sheets)for(const [i,a] of sheet.entries()){
      const b=pages[a.page].badge;assert.equal(a.w,a.rotated?b.h:b.w);assert.equal(a.h,a.rotated?b.w:b.h);assert.ok(a.x>=5&&a.y>=5&&a.x+a.w<=325.200001&&a.y+a.h<=477.600001);
      for(const c of sheet.slice(i+1))assert.ok(a.x+a.w+2<=c.x+1e-8||c.x+c.w+2<=a.x+1e-8||a.y+a.h+2<=c.y+1e-8||c.y+c.h+2<=a.y+1e-8);
    }
  }
});
test('bundled classifier loads and returns no faces on a blank image',()=>{
  const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../vendor/pico/pico.js',import.meta.url),'utf8'),context);
  const classify=context.pico.unpack_cascade(new Int8Array(readFileSync(new URL('../vendor/pico/facefinder.bin',import.meta.url))));
  const hits=context.pico.run_cascade({pixels:new Uint8Array(128*128).fill(255),nrows:128,ncols:128,ldim:128},classify,{shiftfactor:.1,minsize:24,maxsize:128,scalefactor:1.1});assert.equal(hits.length,0);
});
test('QR caption escapes content and stays outside the code square',()=>{
  globalThis.window={qrcode:()=>({addData(){},make(){},getModuleCount(){return 21;},isDark(){return false;}})};
  try{const p=newPage(),o=makeObject('qr',p);o.value='A < B';o.qrCaption=true;p.objects.push(o);const svg=pageSVG(p,{});assert.ok(svg.includes('A &lt; B'));assert.ok(svg.includes('viewBox="0 0 29 29"'));}finally{delete globalThis.window;}
});
