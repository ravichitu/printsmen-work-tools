import {productSettings,productGeometry,productSVG,productSheet,artworkPlacement,productProject} from './products-core.js';
import {UNIT_MM} from './automation-core.js';
import {number,esc} from './core.js';
import {importImages,importPDFs,download,canvasFor,loadImage,LIMITS} from './files.js';
import {addDensity} from './export.js';
import {uploadName,outputName} from './naming.js';
import {registerJobAdapter,confirmAction,outputStatus} from './assistant.js';
import {productPDF} from './product-pdf.js';
const $=id=>document.getElementById(id),papers={a4:[210,297],a3:[297,420],'12x18':[304.8,457.2],'13x18':[330.2,457.2],'13x19':[330.2,482.6]},history=[];
const studio=['box','dangler','mockup'].includes(new URLSearchParams(location.search).get('studio'))?new URLSearchParams(location.search).get('studio'):'box';
const studioNames={box:'Box Design',dangler:'Dangler Design',mockup:'3D Mockup Studio'};
document.title=`PrintsMen | ${studioNames[studio]}`;
document.body.dataset.studio=studio;
$('studioHeading').textContent=studioNames[studio].toUpperCase();
$('studioTitle').textContent=studioNames[studio];
$('studioIntro').textContent=studio==='dangler'?'Design hanging tags with exact shape, hole, front/back artwork and print sheets.':studio==='mockup'?'Upload and place artwork, then rotate or animate a presentation mockup. Dimensions remain editable below.':'Build trays or sleeves at finished dimensions, then arrange copies on print sheets.';
for(const link of document.querySelectorAll('header nav a'))if(new URL(link.href).searchParams.get('studio')===studio)link.setAttribute('aria-current','page');
let state={schema:1,type:'printsmen-product',name:'custom_product',autoName:true,settings:productSettings({mode:'tray',unit:'mm',w:80,h:120,d:30,tab:12,bleed:3,safe:3}),background:'#ffffff',assets:[],art:{}},geometry,sheets=[],sheetIndex=0,working=null,dirty=false;
if(studio==='dangler')state.settings=productSettings({mode:'dangler',unit:'mm',w:50,h:70,d:0,tab:0,bleed:3,safe:3,shape:'rect',sides:6,hole:3,holeY:8});
const status=message=>$('productStatus').textContent=message;
const outputActivity=outputStatus($('productProgress'));
const paperIds=['paper','orientation','paperW','paperH','productCopies','productMargin','productGap','previewSide','duplex','printGuides'];
const paperState=()=>Object.fromEntries(paperIds.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
const restorePaper=paper=>{for(const id of paperIds)if(paper?.[id]!==undefined)$(id)[$(id).type==='checkbox'?'checked':'value']=paper[id];};
const copyState=()=>({...state,settings:{...state.settings},assets:[...state.assets],art:structuredClone(state.art),paper:paperState()});
function artMap(){return Object.fromEntries(Object.entries(state.art).map(([id,a])=>[id,{...state.assets.find(asset=>asset.id===a.assetId),...a}]));}
function options(){return {w:number($('paperW').value,10,1000),h:number($('paperH').value,10,1000),copies:number($('productCopies').value,1,500,true),margin:number($('productMargin').value,0,100),gap:number($('productGap').value,0,100)};}
function remember(){history.push(copyState());if(history.length>12)history.shift();}
function change(fn){if(working)return false;const before=copyState();try{fn();productGeometry(state.settings);history.push(before);if(history.length>12)history.shift();dirty=true;render();return true;}catch(e){state=before;restorePaper(before.paper);status(e.message);return false;}}
function syncInputs(){const s=state.settings;$('unit').value='mm';for(const [id,key] of Object.entries({mode:'mode',width:'w',height:'h',depth:'d',glue:'tab',bleed:'bleed',safe:'safe',shape:'shape',sides:'sides',hole:'hole',holeY:'holeY'}))$(id).value=s[key];$('background').value=state.background;$('productName').value=state.name;}
function drawSheet(){if(!sheets.length){$('sheetPreview').replaceChildren();return;}sheetIndex=Math.min(sheetIndex,sheets.length-1);const o=options(),sheet=sheets[sheetIndex];$('sheetInfo').textContent=`Sheet ${sheetIndex+1}/${sheets.length}; ${sheet.length} copies on this sheet; ${o.copies} total. Paper ${o.w} x ${o.h} mm. No scaling.`;$('sheetPreview').innerHTML=`<svg viewBox="0 0 ${o.w} ${o.h}" aria-label="Exact-size sheet arrangement"><rect width="${o.w}" height="${o.h}" fill="white"/>${sheet.map((p,i)=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#fbe7ec" stroke="#bd1539" stroke-width=".3"/><text x="${p.x+p.w/2}" y="${p.y+p.h/2}" text-anchor="middle" font-size="6">${i+1}</text>`).join('')}</svg>`;$('prevProductSheet').disabled=sheetIndex===0;$('nextProductSheet').disabled=sheetIndex===sheets.length-1;}
function selectOptions(element,entries,keep){element.replaceChildren();for(const [value,label] of entries){const option=document.createElement('option');option.value=value;option.textContent=label;element.append(option);}if(entries.some(([value])=>value===keep))element.value=keep;}
function syncArtInputs(){const a=state.art[$('faceChoice').value]||{fit:'cover',zoom:1,x:0,y:0};$('fit').value=a.fit;$('artZoom').value=a.zoom*100;$('artX').value=a.x*100;$('artY').value=a.y*100;}
function render(){geometry=productGeometry(state.settings);const dangler=state.settings.mode==='dangler';$('danglerControls').hidden=!dangler;$('duplexControls').hidden=!dangler;$('depth').disabled=dangler;$('glue').disabled=dangler;$('undoProduct').disabled=!history.length;selectOptions($('faceChoice'),[...geometry.faces.filter(f=>!/^tab|glue/.test(f.id)).map(f=>[f.id,f.label]),...(dangler?[['back','Back']]:[])],$('faceChoice').value);selectOptions($('assetChoice'),state.assets.length?state.assets.map(a=>[a.id,a.name]):[['','No artwork uploaded']],$('assetChoice').value);$('productPreview').innerHTML=productSVG(geometry,{art:artMap(),background:state.background,guides:true,safeGuides:true,labels:$('labels').checked,side:$('previewSide').value});$('geometryInfo').textContent=`Finished ${state.settings.w} x ${state.settings.h}${state.settings.d?' x '+state.settings.d:''} mm. Unfolded / allowance bounds: ${geometry.w} x ${geometry.h} mm.`;
  syncArtInputs();if(!dangler)$('previewSide').value='front';
  const warnings=[];for(const f of [...geometry.faces,...(dangler?[{...geometry.faces[0],id:'back',label:'Back'}]:[])]){const a=artMap()[f.id];if(a){const dpi=artworkPlacement(f,a,a).dpi;if(dpi<300)warnings.push(f.label+': effective resolution '+Math.round(dpi)+' DPI, below 300. Resampling cannot restore missing detail.');}}
  try{sheets=productSheet(geometry,options());drawSheet();}catch(e){sheets=[];$('sheetPreview').replaceChildren();$('sheetInfo').textContent=e.message;warnings.push(e.message);}
  status(warnings.join(' '));drawMockup();}
function readSettings(){return productSettings({mode:$('mode').value,unit:$('unit').value,w:$('width').value,h:$('height').value,d:$('depth').value,tab:$('glue').value,bleed:$('bleed').value,safe:$('safe').value,shape:$('shape').value,sides:$('sides').value,hole:$('hole').value,holeY:$('holeY').value});}
$('productForm').onsubmit=e=>{e.preventDefault();change(()=>{state.settings=readSettings();state.background=$('background').value;});};
$('mode').onchange=()=>{$('danglerControls').hidden=$('mode').value!=='dangler';$('depth').disabled=$('mode').value==='dangler';$('glue').disabled=$('mode').value==='dangler';if($('mode').value!=='dangler'){if(Number($('depth').value)<=0)$('depth').value=30/UNIT_MM[$('unit').value];if(Number($('glue').value)<=0)$('glue').value=12;}};
let previousUnit='mm';$('unit').onchange=()=>{const next=$('unit').value;for(const id of ['width','height','depth']){const n=Number($(id).value);if(Number.isFinite(n)&&n>0)$(id).value=Number((n*UNIT_MM[previousUnit]/UNIT_MM[next]).toFixed(8));}previousUnit=next;};
$('productName').oninput=()=>{state.name=$('productName').value.slice(0,80)||'custom_product';state.autoName=false;dirty=true;};
$('labels').onchange=render;
$('undoProduct').onclick=()=>{if(!working&&history.length){state=history.pop();restorePaper(state.paper);syncInputs();previousUnit='mm';render();dirty=true;}};
$('previewSide').onchange=render;
function selectPaper(){const size=papers[$('paper').value];if(size){const [w,h]=$('orientation').value==='landscape'?[size[1],size[0]]:size;[$('paperW').value,$('paperH').value]=[w,h];}dirty=true;render();}
$('paper').onchange=selectPaper;$('orientation').onchange=()=>{let w=Number($('paperW').value),h=Number($('paperH').value);[$('paperW').value,$('paperH').value]=$('orientation').value==='landscape'?[Math.max(w,h),Math.min(w,h)]:[Math.min(w,h),Math.max(w,h)];render();};
for(const id of ['paperW','paperH','productCopies','productGap','productMargin'])$(id).onchange=()=>{dirty=true;if(id==='paperW'||id==='paperH')$('paper').value='custom';render();};
for(const id of ['duplex','printGuides'])$(id).onchange=()=>{dirty=true;};
const orientChange=$('orientation').onchange;$('orientation').onchange=()=>{dirty=true;orientChange();};
$('prevProductSheet').onclick=()=>{if(sheetIndex>0)sheetIndex--;drawSheet();};$('nextProductSheet').onclick=()=>{if(sheetIndex+1<sheets.length)sheetIndex++;drawSheet();};
let disabledControls=new Map();
function lock(value,kind){if(value){disabledControls=new Map([...document.querySelectorAll('input,select,button')].map(e=>[e,e.disabled]));for(const e of disabledControls.keys())e.disabled=true;}else{for(const [e,disabled] of disabledControls)e.disabled=disabled;disabledControls.clear();}$(kind==='import'?'cancelProductImport':'cancelProductExport').hidden=!value;$(kind==='import'?'cancelProductImport':'cancelProductExport').disabled=false;if(!value){$('depth').disabled=$('glue').disabled=state.settings.mode==='dangler';$('undoProduct').disabled=!history.length;$('prevProductSheet').disabled=sheetIndex===0;$('nextProductSheet').disabled=sheetIndex>=sheets.length-1;}}
$('artUpload').onchange=async e=>{const files=Array.from(e.target.files);e.target.value='';if(!files.length||working)return;working=new AbortController();lock(true,'import');try{if(files.length+state.assets.length>20)throw new Error('Keep at most 20 imported images/PDF pages in this project.');const added=[];for(const file of files){const all=[...state.assets,...added],opts={signal:working.signal,remainingItems:20-all.length,remainingBytes:LIMITS.assets-all.reduce((n,a)=>n+a.data.length,0),remainingPixels:LIMITS.importPixels-all.reduce((n,a)=>n+a.w*a.h,0),progress:status};const assets=file.type==='application/pdf'||/\.pdf$/i.test(file.name)?await importPDFs([file],status,opts):await importImages([file],opts);added.push(...assets.map(a=>({...a,id:crypto.randomUUID()})));}working.signal.throwIfAborted();remember();state.assets.push(...added);if(state.autoName){state.name=uploadName(files);$('productName').value=state.name;}dirty=true;render();$('assetChoice').value=added[0].id;status(`Imported ${added.length} image(s)/PDF page(s). Choose a panel and click Place selected artwork.`);}catch(err){status(err.message);}finally{working=null;lock(false,'import');}};
$('cancelProductImport').onclick=()=>working?.abort();$('cancelProductExport').onclick=()=>working?.abort();
function artOptions(){return {fit:$('fit').value,zoom:number($('artZoom').value,100,500)/100,x:number($('artX').value,-100,100)/100,y:number($('artY').value,-100,100)/100};}
$('assignArt').onclick=()=>change(()=>{const id=$('assetChoice').value;if(!state.assets.some(a=>a.id===id))throw new Error('Upload and select artwork first.');state.art[$('faceChoice').value]={assetId:id,...artOptions()};});
$('applyArt').onclick=()=>change(()=>{const art=state.art[$('faceChoice').value];if(!art)throw new Error('Place artwork on this panel first.');Object.assign(art,artOptions());});
$('faceChoice').onchange=syncArtInputs;
$('removeArt').onclick=()=>change(()=>delete state.art[$('faceChoice').value]);
$('deleteAsset').onclick=()=>change(()=>{const id=$('assetChoice').value;state.assets=state.assets.filter(a=>a.id!==id);for(const [face,a] of Object.entries(state.art))if(a.assetId===id)delete state.art[face];});

function view(){const m=$('mockup');m.style.setProperty('--turn',$('turn').value+'deg');m.style.setProperty('--tilt',$('tilt').value+'deg');m.style.setProperty('--zoom',String(Number($('viewZoom').value)/100));m.style.setProperty('--light',String(Number($('light').value)/100));m.classList.toggle('mock-spinning',$('spin').checked);}
function drawMockup(){const s=state.settings,m=$('mockup');m.replaceChildren();const k=220/Math.max(s.w,s.h,s.d||1),W=s.w*k,H=(s.mode==='tray'?s.d:s.h)*k,D=(s.mode==='tray'?s.h:s.d||1)*k;
  function face(id,w,h,transform){const element=document.createElement('div');element.className='mock-face';element.style.width=w+'px';element.style.height=h+'px';element.style.marginLeft=-w/2+'px';element.style.marginTop=-h/2+'px';element.style.transform=transform;element.style.backgroundColor=state.background;const a=artMap()[id],f=geometry.faces.find(f=>f.id===id)||(s.mode==='dangler'?geometry.faces[0]:null);if(a&&f){const p=artworkPlacement(f,a,a);element.style.backgroundImage=`url("${a.data}")`;element.style.backgroundRepeat='no-repeat';element.style.backgroundSize=p.w/f.w*100+'% '+p.h/f.h*100+'%';element.style.backgroundPosition=(f.w===p.w?50:(p.x-f.x)/(f.w-p.w)*100)+'% '+(f.h===p.h?50:(p.y-f.y)/(f.h-p.h)*100)+'%';}m.append(element);return element;}
  if(s.mode==='dangler'){for(const [id,transform] of [['front','translateZ(1px)'],['back','rotateY(180deg) translateZ(1px)']]){const f=face(id,s.w*k,s.h*k,transform);f.style.backfaceVisibility='hidden';if(geometry.points)f.style.clipPath='polygon('+geometry.points.map(([x,y])=>(x-s.bleed)/s.w*100+'% '+(y-s.bleed)/s.h*100+'%').join(',')+')';}}
  else{face(s.mode==='tray'?'bottom':'front',W,H,`translateZ(${D/2}px)`);face(s.mode==='tray'?'top':'back',W,H,`rotateY(180deg) translateZ(${D/2}px)`);face(s.mode==='tray'?'right':'side1',D,H,`rotateY(90deg) translateZ(${W/2}px)`);face(s.mode==='tray'?'left':'side2',D,H,`rotateY(-90deg) translateZ(${W/2}px)`);if(s.mode==='tray')face('base',W,D,`rotateX(-90deg) translateZ(${H/2}px)`);}view();}
for(const id of ['turn','tilt','viewZoom','light','spin'])$(id).oninput=view;
$('resetView').onclick=()=>{$('turn').value=-25;$('tilt').value=-15;$('viewZoom').value=$('light').value=100;$('spin').checked=false;view();};
let drag;const stage=$('mockupStage');stage.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,turn:Number($('turn').value),tilt:Number($('tilt').value)};stage.setPointerCapture(e.pointerId);$('spin').checked=false;view();};stage.onpointermove=e=>{if(!drag)return;$('turn').value=Math.max(-180,Math.min(180,drag.turn+(e.clientX-drag.x)*.5));$('tilt').value=Math.max(-75,Math.min(75,drag.tilt-(e.clientY-drag.y)*.3));view();};stage.onpointerup=stage.onpointercancel=()=>{drag=null;};
async function png(g,guides,side=$('previewSide').value){const canvas=canvasFor(g.w/25.4*300,g.h/25.4*300),url=URL.createObjectURL(new Blob([productSVG(g,{art:artMap(),background:state.background,guides,side})],{type:'image/svg+xml'}));try{const image=await loadImage(url);working?.signal.throwIfAborted();canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Cannot generate image.');return addDensity(new Uint8Array(await blob.arrayBuffer()),'png',300);}finally{URL.revokeObjectURL(url);canvas.width=canvas.height=0;}}
function assertApplied(){const draft=readSettings();if(Object.keys(draft).some(k=>Math.abs(Number(draft[k])-Number(state.settings[k]))>1e-5||typeof draft[k]==='string'&&draft[k]!==state.settings[k])||$('background').value!==state.background)throw new Error('Click Apply dimensions before exporting or saving. The preview still shows the previous settings.');}
async function exportOutput(format){
  if(working)return;
  try{assertApplied();}catch(e){status(e.message);return;}
  if(!await confirmAction('Export at the applied dimensions? Check artwork, trim and folds. A physical proof is required.','Confirm export'))return;
  working=new AbortController();lock(true,'export');outputActivity.start();$('productProgress').scrollIntoView({block:'nearest'});
  try{
    await new Promise(resolve=>setTimeout(resolve,0));working.signal.throwIfAborted();
    const g=productGeometry(state.settings),guides=$('printGuides').checked,side=$('previewSide').value;
    if(format==='svg')download(productSVG(g,{art:artMap(),background:state.background,guides,side}),outputName(state.name,{tool:state.settings.mode+'_'+side,extension:'svg'}),'image/svg+xml');
    else if(format==='png'){outputActivity.update(null,'Rendering 300 DPI artwork and encoding PNG...');const bytes=await png(g,guides);working.signal.throwIfAborted();download(bytes,outputName(state.name,{tool:state.settings.mode+'_'+side,extension:'png'}),'image/png');}
    else{const bytes=await productPDF(g,options(),{pdfLib:window.PDFLib,rasterize:side=>png(g,false,side),guides,duplex:$('duplex').checked,signal:working.signal,progress:(n,message)=>outputActivity.update(n,message)});download(bytes,outputName(state.name,{tool:state.settings.mode}),'application/pdf');}
    outputActivity.finish('done','Download requested. Check your browser downloads and print at 100% / Actual Size.');
    status('Download requested. Verify Actual Size / 100% when printing.');
  }catch(e){const cancelled=working.signal.aborted;outputActivity.finish(cancelled?'cancelled':'error',cancelled?'No new output was downloaded.':e.message);status(cancelled?'Export cancelled.':e.message);}finally{working=null;lock(false,'export');}
}
$('exportProductPdf').onclick=()=>exportOutput('pdf');$('exportProductSvg').onclick=()=>exportOutput('svg');$('exportProductPng').onclick=()=>exportOutput('png');
$('saveProduct').onclick=()=>{try{assertApplied();const text=JSON.stringify({...state,paper:paperState(),duplex:$('duplex').checked});if(text.length>LIMITS.assets*1.1)throw new Error('Project exceeds the save limit; remove unused uploads.');download(text,outputName(state.name,{extension:'json'}),'application/json');dirty=false;}catch(e){status(e.message);}};
$('openProduct').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||working)return;
  working=new AbortController();lock(true,'import');
  try{
    if(file.size>LIMITS.assets*1.1)throw new Error('Project exceeds 66 MB.');
    const next=productProject(JSON.parse(await file.text()),LIMITS);
    for(const a of next.assets){working.signal.throwIfAborted();const image=await loadImage(a.data);if(image.naturalWidth!==a.w||image.naturalHeight!==a.h)throw new Error('An image does not match its recorded pixel dimensions.');}
    working.signal.throwIfAborted();
    if(dirty&&!await confirmAction('Replace this project? Save your existing work first.','Replace product project'))return;
    remember();state=next;restorePaper(state.paper);syncInputs();previousUnit='mm';dirty=false;render();status('Project restored, including paper, copies and artwork.');
  }catch(e){status(e.message);}finally{working=null;lock(false,'import');}
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
registerJobAdapter('products',async plan=>{if(working)throw new Error('Wait for the current job to finish.');if(plan.mode==='mockup'){$('mockupStage').scrollIntoView({block:'center'});return;}const settings=productSettings({...state.settings,...plan.size,tab:Math.min(state.settings.tab||12,plan.size?.d||30),mode:plan.mode,shape:plan.shape,unit:'mm'});productGeometry(settings);if(!change(()=>{state.settings=settings;if(plan.copies!==null)$('productCopies').value=plan.copies;if(plan.paper){$('paper').value=plan.paper;$('orientation').value=plan.landscape?'landscape':'portrait';const size=plan.landscape?[...plan.paperSize].reverse():plan.paperSize;[$('paperW').value,$('paperH').value]=size;}}))throw new Error('Settings could not be applied.');syncInputs();previousUnit='mm';render();});
syncInputs();
render();
