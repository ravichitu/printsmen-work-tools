import {PRESETS,PRESET_GROUPS,clone,uid,esc,number,newPage,newProject,makeObject,validateBadge,boundary,alignObjects,fitObjects,copyPage,parseCSV} from './core.js';
import {pageSVG,preflight} from './render.js';
import {LIMITS,ranges,checkCapacity,compactProject,validateProject,download,safeName,importImages,importPDFs,autosaveStore,loadImage,canvasFor} from './files.js';
import {exportProject,calibrationPDF} from './export.js';
import {importFont,installFonts,validateFonts} from './fonts.js';
import {rotateCrop,cropSelection} from './crop.js';
import {PAPER_SIZES,printPlan,sheetCapacity} from './print-plan.js';
import {installPhotoEditor} from './photo-editor.js';
import {scaleBorders} from './photo.js';
import {photoCanvas} from './faces.js';
import {catalogueCategories,catalogueMarkup,projectFromCatalogue} from './catalogue.js';
import {registerJobAdapter,outputStatus} from './assistant.js';
import {uploadName} from './naming.js';

const $=id=>document.getElementById(id),store=autosaveStore();
const outputActivity=outputStatus($('exportProgress'));
let project=newProject(),pageIndex=0,selection=[],panel='badge',history=[],future=[],clipboard=[],csv=null,busy=false,pan=false,saveTimer,toastTimer,exportController;
let saveGeneration=0,unsaved=false,saveBlocked=false;
let hasWorkspace=false,autoProjectName=true;
const page=()=>project.pages[pageIndex],picked=()=>page().objects.filter(o=>selection.includes(o.id)),editable=()=>picked().filter(o=>!o.locked);
const paperFields=['sheetPreset','sheetW','sheetH','sheetOrientation'];
const snapshot=()=>JSON.stringify({name:project.name,pages:project.pages,index:pageIndex,paper:Object.fromEntries(paperFields.map(id=>[id,$(id).value]))});
function restore(s){const state=JSON.parse(s);project.name=state.name;project.pages=state.pages;pageIndex=state.index;for(const [id,value] of Object.entries(state.paper||{}))$(id).value=value;selection=[];render();scheduleSave();}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5000);}
function confirmReplace(message,title='Replace workspace?',accept='Replace workspace'){return new Promise(resolve=>{const d=document.createElement('dialog');d.innerHTML=`<h2>${esc(title)}</h2><p class="hint">${esc(message)}</p><div class="actions"><button data-answer="no">Cancel</button><button data-answer="yes" class="primary">${esc(accept)}</button></div>`;document.body.append(d);const finish=value=>{d.close();d.remove();resolve(value);};d.addEventListener('click',e=>{const answer=e.target.closest('[data-answer]')?.dataset.answer;if(answer)finish(answer==='yes');});d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});d.showModal();});}
function scheduleSave(){clearTimeout(saveTimer);unsaved=true;const generation=++saveGeneration;if(saveBlocked)return;$('saveStatus').textContent='Unsaved changes';saveTimer=setTimeout(async()=>{try{await store.write(compactProject(project));if(generation===saveGeneration){unsaved=false;$('saveStatus').textContent='Saved on this device';}}catch(e){saveBlocked=true;$('saveRecovery').hidden=false;$('saveStatus').textContent='Autosave paused - Save Project';toast(e.message);}},700);}
window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
function finish(before){checkCapacity(project);if(before!==snapshot()){history.push(before);if(history.length>40)history.shift();future=[];scheduleSave();}render();}
function change(fn){if(busy)return;const before=snapshot(),oldAssets={...project.assets};try{fn();finish(before);}catch(e){const state=JSON.parse(before);project.pages=state.pages;project.name=state.name;project.assets=oldAssets;pageIndex=state.index;toast(e.message);render();}}
function undo(){if(!history.length||busy)return;future.push(snapshot());restore(history.pop());}
function redo(){if(!future.length||busy)return;history.push(snapshot());restore(future.pop());}
function setBusy(value){busy=value;document.body.classList.toggle('busy',value);$('catalogueHome').inert=value;$('catalogueHome').setAttribute('aria-busy',String(value));}
function catalogueStatus(){
  $('catalogueResume').hidden=!hasWorkspace&&!saveBlocked;
  $('resumeWorkspace').hidden=!hasWorkspace;
  $('catalogueWorkspaceStatus').textContent=hasWorkspace?`${project.name} - ${project.pages.length} page(s)`:saveBlocked?'Restore failed. Open a project backup.':'';
}
function showCatalogue(){
  if(busy)return;
  $('editorWorkspace').hidden=true;$('catalogueHome').hidden=false;$('showCatalogue').hidden=true;
  document.body.classList.add('catalogue-mode');selectCatalogue('all');catalogueStatus();$('catalogueTitle').focus();window.scrollTo(0,0);
}
function openWorkspace(){
  hasWorkspace=true;$('catalogueHome').hidden=true;$('editorWorkspace').hidden=false;$('showCatalogue').hidden=false;
  document.body.classList.remove('catalogue-mode');window.scrollTo(0,0);render();$('projectName').focus();
}
function replaceWorkspace(next,automaticName=false){
  autoProjectName=automaticName;project=next;pageIndex=0;selection=[];history=[];future=[];clipboard=[];csv=null;panel='badge';openWorkspace();scheduleSave();
}
$('catalogueGroups').innerHTML=catalogueMarkup();
$('catalogueCategories').innerHTML=catalogueCategories();
function selectCatalogue(value){
  const overview=value==='all';
  $('catalogueCategories').hidden=!overview;$('catalogueFilters').hidden=overview;
  $('catalogueGroups').hidden=overview||value==='custom';
  $('catalogueGroups').querySelectorAll('[data-catalogue-group]').forEach(group=>group.hidden=group.dataset.catalogueGroup!==value);
  $('catalogueCustom').hidden=value!=='custom';$('catalogueFootnote').hidden=overview;
}
$('allCatalogues').onclick=()=>{if(!busy){selectCatalogue('all');$('catalogueTitle').focus();}};
$('catalogueCategories').onclick=e=>{
  const button=e.target.closest('[data-open-catalogue]');if(!button||busy)return;
  selectCatalogue(button.dataset.openCatalogue);$('allCatalogues').focus();
};
$('catalogueHome').addEventListener('click',async e=>{
  const button=e.target.closest('[data-start-preset]');if(!button||busy)return;
  setBusy(true);
  try{
    if(hasWorkspace&&!await confirmReplace('Starting a new design replaces your current workspace. Cancel and use Resume design to save a project file or library copy first.','Start a new design?','Start new design'))return;
    replaceWorkspace(projectFromCatalogue(button.dataset.startPreset),true);
    if(button.dataset.startPreset==='custom')$('badgeForm').elements.namedItem('w').focus();
  }catch(err){toast(err.message);}finally{setBusy(false);}
});
$('showCatalogue').onclick=showCatalogue;
$('resumeWorkspace').onclick=()=>{if(!busy&&hasWorkspace)openWorkspace();};
$('catalogueLibrary').onclick=()=>{if(!busy)openLibrary().catch(err=>toast(err.message));};
$('catalogueOpen').onclick=()=>{if(!busy)$('projectInput').click();};
const photoEditor=installPhotoEditor({getProject:()=>project,change,setBusy,toast});
const round=n=>Math.round(n*1000)/1000;
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`;
const field=(label,key,value,type='number',attrs='')=>`<label>${label}<input data-prop="${key}" type="${type}" value="${esc(type==='number'?round(value):value)}" ${type==='number'?'step="any"':''} ${attrs}></label>`;
const select=(label,key,value,items)=>`<label>${label}<select data-prop="${key}">${items.map(v=>option(Array.isArray(v)?v[0]:v,Array.isArray(v)?v[1]:v,value)).join('')}</select></label>`;
const check=(label,key,value)=>`<label class="check"><input data-prop="${key}" type="checkbox" ${value?'checked':''}>${label}</label>`;
const action=(name,label,attrs='')=>`<button type="button" data-action="${name}" ${attrs}>${label}</button>`;
const section=(name,body)=>`<section class="panel-section"><h3>${name}</h3>${body}</section>`;
const grid=body=>`<div class="form-grid">${body}</div>`;
function renderBoard(){
  $('board').innerHTML=pageSVG(page(),project.assets,{guides:$('showGuides').checked,grid:$('showGrid').checked,top:$('showTop').checked,overlay:true,selection});
  fitView();
}
function fitView(){const b=page().badge,s=$('stage'),scale=Math.max(.2,Math.min((s.clientWidth-70)/b.w,(s.clientHeight-70)/b.h))*Number($('zoom').value)/100;$('board').style.width=b.w*scale+'px';$('board').style.height=b.h*scale+'px';$('zoomLabel').textContent=$('zoom').value+'%';}
function render(){
  if($('editorWorkspace').hidden)return;
  const p=page(),b=p.badge;
  selection=selection.filter(id=>p.objects.some(o=>o.id===id));
  $('projectName').value=project.name;$('badgeTitle').textContent=b.name;
  for(const [id,w,h] of [['safeInfo',b.safeW,b.safeH],['faceInfo',b.faceW,b.faceH],['cutInfo',b.w,b.h]])$(id).textContent=b.shape==='round'?`${w} mm diameter`:`${w} x ${h} mm`;
  $('pageSelect').innerHTML=project.pages.map((p,i)=>option(i,`${i+1}. ${p.name}`,pageIndex)).join('');$('copies').value=p.copies;
  $('prevPage').disabled=pageIndex===0;$('nextPage').disabled=pageIndex===project.pages.length-1;$('undo').disabled=!history.length;$('redo').disabled=!future.length;
  $('deleteObject').disabled=!editable().length;$('duplicateObject').disabled=!picked().length;
  $('preflight').textContent=preflight(p,project.assets).slice(0,5).join(' ');
  renderBoard();renderPanel();
}
function renderPanel(){
  document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
  const p=page(),b=p.badge,o=picked()[0];let html='';
  if(panel==='badge'){
    const s=boundary(b);html=section('Badge presets',`<label>Category / Size<select id="badgePreset">${option('custom','Custom dimensions',b.id)}${PRESET_GROUPS.map(group=>`<optgroup label="${esc(group.name)}">${group.ids.map(id=>{const v=PRESETS.find(p=>p.id===id);return option(v.id,v.name,b.id);}).join('')}</optgroup>`).join('')}</select></label><p class="hint">Choose a size under its category. 16 measured presets; face / bleed line is not the full cut size. Check machine fit with a physical proof.</p>`);
    html+=section('Custom measurements (mm)',`<form id="badgeForm"><label>Shape<select name="shape">${option('round','Round',b.shape)}${option('rect','Rectangle / square',b.shape)}</select></label>${grid(['w','h','faceW','faceH','safeW','safeH','safeX','safeY','cornerRadius'].map((k,i)=>`<label>${['Cut width','Cut height','Face width','Face height','Safe width','Safe height','Safe X offset','Safe Y offset','Corner radius'][i]}<input name="${k}" type="number" step="any" min="${i<6?1:0}" max="1000" required value="${b[k]??(k==='safeX'?s.x:k==='safeY'?s.y:0)}"></label>`).join(''))}<button type="submit" class="primary">Apply dimensions</button><p id="badgeError" role="alert" class="danger"></p></form><p class="hint">Offsets start at the artwork's top-left. Wristband reserves 38 mm at the left.</p>`);
    html+=section('Page background',select('Background','bgMode',p.bgMode,['solid','linear','transparent'])+grid(field('Colour','bg',p.bg,'color')+field('Second colour','bg2',p.bg2,'color'))+field('Gradient angle','bgAngle',p.bgAngle)+action('backgroundAll','Apply background to all pages'));
  }else if(panel==='shapes')html=section('Add a shape',grid(['rect','circle','triangle','polygon','star','hexagon','diamond','heart','line','arrow'].map(t=>`<button data-add="${t}">${t==='rect'?'Rectangle':t[0].toUpperCase()+t.slice(1)}</button>`).join('')));
  else if(panel==='layers')html=section('Layers: front to back',p.objects.length?[...p.objects].reverse().map(v=>`<div class="layer ${selection.includes(v.id)?'active':''}"><button class="layer-name" data-layer="${v.id}" title="Shift-click for multiple selection">${esc(v.name)}${v.group?' (group)':''}</button><button data-layer-action="hide" data-id="${v.id}" aria-label="${v.hidden?'Show':'Hide'} ${esc(v.name)}">${v.hidden?'Show':'Hide'}</button><button data-layer-action="lock" data-id="${v.id}" aria-label="${v.locked?'Unlock':'Lock'} ${esc(v.name)}">${v.locked?'Unlock':'Lock'}</button></div>`).join(''):'<p class="hint">Add text, images or shapes to begin.</p>')+section('Arrange selection',`<div class="row">${action('forward','Forward')}${action('backward','Backward')}</div><div class="row">${action('front','To front')}${action('back','To back')}</div><div class="row">${action('group','Group')}${action('ungroup','Ungroup')}</div>`);
  else if(panel==='batch')html=section('CSV bulk data',`<p class="hint">Upload a UTF-8 CSV with unique column headings. Link selected text, QR or barcode objects, then create one new page per row. Existing pages stay unchanged.</p>${action('csv','Import CSV')}${csv?`<p class="chip">${csv.rows.length} rows / ${csv.headers.length} columns</p>`:''}${o&&['text','curve','qr','barcode'].includes(o.type)&&csv?select('Linked column','field',o.field,[['','Not linked'],...csv.headers]):'<p class="hint">Select a text or code layer to link a column.</p>'}<div class="row">${action('generate','Generate pages',!csv?'disabled':'')}</div>`);
  else if(panel==='templates')html=section('Local starter designs',`<p class="hint">Original PrintsMen starters. Adds a new page without replacing your artwork.</p><div class="row">${action('templateName','Name badge')}${action('templateRound','Round badge')}</div>${action('library','My saved designs')}<p class="hint">Save named copies in the local library. Download project files for backups: clearing browser data also clears the library.</p>`);
  else if(panel==='help')html=section('Working locally',`<p class="hint">Drag to move. Drag the corner to resize; hold Shift for the original aspect ratio. The upper handle rotates. Shift-click selects multiple objects. Group alignment preserves their relative positions.</p><p class="hint">Ctrl+Z undo; Ctrl+Y redo; Ctrl+C/V copy/paste within this editor; Ctrl+D duplicate; Ctrl+G group; Ctrl+Shift+G ungroup; Delete removes unlocked items; arrows move 0.1 mm (Shift: 1 mm).</p><p class="hint">PNG/JPG/PDF raster output is RGB. SVG retains text and shapes; fonts must exist on the receiving machine. PDF imports rasterise at 300 DPI. Export DPI cannot recover missing image detail.</p><p class="hint">Limits: 100 pages, 150 objects per page, 2,000 objects total, 60 MB embedded assets, 24 MP per raster, 500 printed badges per export. Save a project before large jobs.</p><p class="hint">No cloud event collection, account/gallery service, or AI background removal. Image colour removal is a local colour-matching operation, not AI. Stretch &amp; spin is a local edge-fill approximation, not a verified copy of the reference algorithm.</p>`);
  else if(!o)html='<div class="empty"><strong>Select an object</strong>Add something from the left, or choose a layer to edit its properties.</div>';
  else{
    html=section(`${picked().length} selected${o.locked?' / locked':''}`,`<div class="row">${action('group','Group')}${action('ungroup','Ungroup')}${action('lock',o.locked?'Unlock':'Lock')}</div><div class="align-grid">${['top-left','top','top-right','left','center','right','bottom-left','bottom','bottom-right'].map(d=>action('align',d,`data-direction="${d}"`)).join('')}</div><div class="row">${action('fit','Fit to safe zone')}</div>`);
    if(picked().length===1) {
      html+=section('Position and size (mm)',field('Layer name','name',o.name,'text')+grid(field('X','x',o.x)+field('Y','y',o.y)+field('Width','w',o.w)+field('Height','h',o.h)+field('Rotation (degrees)','rotation',o.rotation)+field('Opacity (0-1)','opacity',o.opacity))+`<div class="row">${action('rotateLeft','Rotate -90')}${action('rotateRight','Rotate +90')}</div>`);
      if(['text','curve'].includes(o.type))html+=section('Text',`<label>Content<textarea data-prop="text" rows="3" maxlength="10000">${esc(o.text)}</textarea></label>`+select('Font','font',o.font,['Arial','Verdana','Georgia','Times New Roman','Tahoma','Trebuchet MS','Courier New','Segoe UI','Impact',...Object.entries(project.fonts||{}).map(([id,f])=>[id,f.name+' (embedded)'])])+action('font','Import local font')+'<p class="hint">TTF / OTF / WOFF / WOFF2. Only import fonts you have permission to embed. Imported fonts travel with the project and SVG; installed system fonts do not.</p>'+grid(field('Font size (mm)','fontSize',o.fontSize)+field('Letter spacing (mm)','spacing',o.spacing))+grid(check('Bold','bold',o.bold)+check('Italic','italic',o.italic)+check('Underline','underline',o.underline)+check('Strike-through','strike',o.strike))+select('Text alignment','align',o.align,[['start','Left'],['middle','Centre'],['end','Right']])+(o.type==='curve'?grid(field('Arc radius (mm)','arcRadius',o.arcRadius)+field('Arc position (%)','arcStart',o.arcStart))+check('Reverse arc','arcFlip',o.arcFlip):''));
      if(['qr','barcode'].includes(o.type))html+=section('Code content',field('Value','value',o.value,'text')+(o.type==='barcode'?select('Barcode format','barcode',o.barcode,['CODE128','CODE39','EAN13','EAN8','UPC','ITF','MSI','pharmacode'])+check('Show readable value','showValue',o.showValue):'<p class="hint">QR uses error correction M and a 4-module quiet zone. Verify with a scanner before production.</p>'));
      if(['text','curve','qr','barcode'].includes(o.type)&&csv)html+=section('Data linking',select('CSV column','field',o.field,[['','Not linked'],...csv.headers]));
      if(o.type==='image')html+=section('Image',select('Image fit','fit',o.fit,[['cover','Cover / crop to fill'],['contain','Contain / preserve all'],['stretch','Stretch to exact size']])+select('Bleed fill','bleed',o.bleed,[['none','None'],['stretch','Stretched edges'],['blur','Background blur'],['spin','Stretch & spin (approximate)']])+`<div class="row">${action('crop','Crop image')}${action('resetCrop','Reset crop')}</div>`+select('Crop shape','cropShape',o.cropShape,[['rect','Rectangle'],['round','Ellipse / round']])+grid(field('Brightness (%)','brightness',o.brightness)+field('Contrast (%)','contrast',o.contrast)+field('Saturation (%)','saturation',o.saturation))+select('Filter','filter',o.filter,['none','grayscale','sepia','invert'])+`<div class="row">${action('clarity','Clarity')}${action('vibrant','Vibrant')}${action('resetImage','Reset effects')}</div><label>Remove matching colour<input type="color" id="removeColour" value="#ffffff"></label><label>Tolerance (0-255)<input id="removeTolerance" type="number" min="0" max="255" value="30"></label>${action('removeColor','Remove colour everywhere')}<p class="hint">Removes matching pixels, including inside letters. Non-AI; use Undo to recover removed detail.</p>`);
      const code=['qr','barcode'].includes(o.type),shapeFill=!code&&o.type!=='image'&&o.type!=='line';
      html+=section('Appearance',(shapeFill?select('Fill type','fillMode',o.fillMode,['solid','linear','radial'])+grid(field('Fill colour','fill',o.fill,'color')+field('Second fill','fill2',o.fill2,'color')+field('Gradient angle','angle',o.angle)+field('Fill opacity','fillOpacity',o.fillOpacity??1)):'')+(code?field('Code colour','fill',o.fill,'color'):grid(field('Border colour','stroke',o.stroke,'color')+field('Border width (mm)','strokeWidth',o.strokeWidth)+field('Border opacity','strokeOpacity',o.strokeOpacity??1))+select('Border style','strokeStyle',o.strokeStyle,['solid','dashed','dotted']))+(o.type==='rect'?field('Corner radius','radius',o.radius):'')+(['polygon','star'].includes(o.type)?field('Sides / points','sides',o.sides):'')+(o.type==='star'?field('Inner ratio','inner',o.inner):'')+check('Drop shadow','shadow',o.shadow)+(o.shadow?grid(field('Shadow colour','shadowColor',o.shadowColor,'color')+field('Shadow opacity','shadowOpacity',o.shadowOpacity)+field('Blur (mm)','shadowBlur',o.shadowBlur)+field('Offset X','shadowX',o.shadowX)+field('Offset Y','shadowY',o.shadowY)):''));
    }
  }
  $('panel').innerHTML=html;
  if(panel==='properties'&&picked().length===1){
    if(o.type==='image')$('panel').insertAdjacentHTML('afterbegin',section('Photo framing',action('photoFrame','Photo zoom / face framing')+'<p class="hint">Independent photo zoom, drag positioning, rotation and local face detection. Also works with the Polaroid preset.</p>'));
    if(o.type==='qr')$('panel').insertAdjacentHTML('beforeend',section('QR caption',check('Show readable QR caption','qrCaption',o.qrCaption)));
    if(!['qr','barcode'].includes(o.type))$('panel').insertAdjacentHTML('beforeend',section('Resize behaviour',check('Scale border and corners when resizing','scaleBorders',o.scaleBorders)));
  }
  $('panel').querySelector('[data-action="clarity"]')?.parentElement.insertAdjacentHTML('afterend',`<div class="row">${action('vintage','Vintage')}${action('mono','B&W')}${action('dramatic','Dramatic')}</div>`);
  if(panel==='properties'&&o?.locked)$('panel').querySelectorAll('[data-prop]').forEach(el=>el.disabled=true);
  $('badgePreset')?.addEventListener('change',e=>{const b=PRESETS.find(b=>b.id===e.target.value);if(b)change(()=>page().badge=clone(b));});
  $('badgeForm')?.addEventListener('submit',e=>{e.preventDefault();try{const fd=new FormData(e.target),b={id:'custom',name:'Custom badge',shape:fd.get('shape')};for(const key of ['w','h','faceW','faceH','safeW','safeH','safeX','safeY','cornerRadius'])b[key]=number(fd.get(key),0,1000);validateBadge(b);change(()=>page().badge=b);}catch(err){$('badgeError').textContent=err.message;}});
}
function add(type){change(()=>{const o=makeObject(type,page());if(type==='line'){o.strokeWidth=.5;o.h=1;}if(type==='barcode'){o.value='123456789012';o.w=page().badge.safeW*.8;o.h=12;}if(type==='curve'){o.arcRadius=Math.min(page().badge.safeW*.35,20);o.w=o.arcRadius*2;o.h=o.arcRadius*2;}page().objects.push(o);alignObjects([o],page().badge,'center');selection=[o.id];panel='properties';});}
function selectedIds(o,multiple){const ids=o.group?page().objects.filter(v=>v.group===o.group).map(v=>v.id):[o.id];return multiple?(ids.every(id=>selection.includes(id))?selection.filter(id=>!ids.includes(id)):[...new Set([...selection,...ids])]):ids;}
function duplicate(){if(!picked().length)return;change(()=>{const c=copyPage({...page(),objects:picked()});c.objects.forEach(o=>{o.x+=2;o.y+=2;});page().objects.push(...c.objects);selection=c.objects.map(o=>o.id);});}
function remove(){change(()=>{const ids=editable().map(o=>o.id);page().objects=page().objects.filter(o=>!ids.includes(o.id));selection=[];});}
const actions={
  align:el=>change(()=>alignObjects(editable(),page().badge,el.dataset.direction)),fit:()=>change(()=>fitObjects(editable(),page().badge)),
  group:()=>change(()=>{if(editable().length<2)throw new Error('Select at least two unlocked objects.');const g=uid();editable().forEach(o=>o.group=g);}),ungroup:()=>change(()=>editable().forEach(o=>o.group=null)),
  lock:()=>change(()=>{const lock=!picked().every(o=>o.locked);picked().forEach(o=>o.locked=lock);}),
  rotateLeft:()=>change(()=>editable().forEach(o=>o.rotation=(o.rotation-90)%360)),rotateRight:()=>change(()=>editable().forEach(o=>o.rotation=(o.rotation+90)%360)),
  front:()=>change(()=>{const objects=editable();page().objects=[...page().objects.filter(o=>!objects.includes(o)),...objects];}),back:()=>change(()=>{const objects=editable();page().objects=[...objects,...page().objects.filter(o=>!objects.includes(o))];}),
  forward:()=>reorder(1),backward:()=>reorder(-1),
  backgroundAll:()=>change(()=>{for(const p of project.pages)for(const k of ['bg','bg2','bgMode','bgAngle'])p[k]=page()[k];}),
  csv:()=>$('csvInput').click(),generate:()=>{if(!csv)return;change(()=>{if(!page().objects.some(o=>o.field))throw new Error('Link at least one text or code layer to a CSV column.');const template=page();for(const row of csv.rows){const p=copyPage(template);p.name=`Data ${project.pages.length+1}`;for(const o of p.objects)if(o.field&&Object.hasOwn(row,o.field))o[['qr','barcode'].includes(o.type)?'value':'text']=row[o.field];project.pages.push(p);}pageIndex=project.pages.length-csv.rows.length;selection=[];});},
  photoFrame:()=>photoEditor.open(picked()[0]),
  crop:()=>openCrop(),resetCrop:()=>change(()=>editable().forEach(o=>{o.crop={x:0,y:0,w:1,h:1};o.cropShape='rect';o.photoRotation=0;})),
  clarity:()=>change(()=>editable().forEach(o=>{o.brightness=105;o.contrast=115;o.saturation=105;})),vibrant:()=>change(()=>editable().forEach(o=>{o.brightness=103;o.contrast=110;o.saturation=125;})),resetImage:()=>change(()=>editable().forEach(o=>{o.brightness=o.contrast=o.saturation=100;o.filter='none';o.bleed='none';})),
  removeColor:()=>removeColour(),templateName:()=>template(false),templateRound:()=>template(true),font:()=>$('fontInput').click(),library:()=>openLibrary(),calibration:()=>calibrationPDF(),audit:()=>openAudit(),
  vintage:()=>imagePreset(108,92,72,'sepia'),mono:()=>imagePreset(100,110,100,'grayscale'),dramatic:()=>imagePreset(95,140,85,'none')
};
function imagePreset(brightness,contrast,saturation,filter){change(()=>editable().filter(o=>o.type==='image').forEach(o=>Object.assign(o,{brightness,contrast,saturation,filter})));}
function reorder(dir){change(()=>{const objects=editable();const list=dir>0?[...objects].reverse():objects;for(const o of list){const i=page().objects.indexOf(o),j=i+dir;if(j>=0&&j<page().objects.length&&!objects.includes(page().objects[j]))[page().objects[i],page().objects[j]]=[page().objects[j],page().objects[i]];}});}
function template(roundBadge){change(()=>{const p=newPage(PRESETS.find(b=>b.id===(roundBadge?'round58':'rect80')));p.name=roundBadge?'Round starter':'Name starter';p.bg='#eaf2ed';const title=makeObject('text',p);title.text=roundBadge?'PRINTSMEN':'YOUR NAME';title.fontSize=roundBadge?6:8;title.w=p.badge.safeW*.85;title.h=12;alignObjects([title],p.badge,'center');const subtitle=makeObject('text',p);subtitle.text='MADE FOR YOU';subtitle.fontSize=2.8;subtitle.w=title.w;subtitle.h=5;subtitle.x=title.x;subtitle.y=title.y+title.h;subtitle.fill='#56776b';p.objects.push(title,subtitle);project.pages.push(p);pageIndex=project.pages.length-1;selection=[title.id];panel='properties';});}
document.addEventListener('click',e=>{
  if(busy)return;const t=e.target.closest('button');if(!t)return;
  if(t.dataset.panel){panel=t.dataset.panel;renderPanel();}
  if(t.dataset.add)add(t.dataset.add);
  if(t.dataset.action)Promise.resolve(actions[t.dataset.action]?.(t)).catch(e=>toast(e.message));
  if(t.dataset.layer){const o=page().objects.find(o=>o.id===t.dataset.layer);selection=selectedIds(o,e.shiftKey);render();}
  if(t.dataset.layerAction)change(()=>{const o=page().objects.find(o=>o.id===t.dataset.id),key=t.dataset.layerAction==='hide'?'hidden':'locked';o[key]=!o[key];});
  if(t.dataset.close&&!exportController)$(t.dataset.close).close();
});
let editingField=null;
function propertyValue(el){const key=el.dataset.prop;let v=el.type==='checkbox'?el.checked:el.value;if(ranges[key])v=number(v,...ranges[key]);if(key==='bgAngle')v=number(v,0,360);if(el.type==='color'&&!/^#[0-9a-f]{6}$/i.test(v))throw new Error('Invalid colour.');return v;}
function assignProperty(key,v){if(['bg','bg2','bgMode','bgAngle'].includes(key))page()[key]=v;else editable().forEach(o=>{if(key==='w'||key==='h'){const original={...o};o[key]=v;scaleBorders(o,original,o.w,o.h);}else o[key]=v;});if((key==='w'||key==='h')&&picked().length===1)for(const k of ['strokeWidth','radius']){const el=$('panel').querySelector(`[data-prop="${k}"]`);if(el)el.value=round(picked()[0][k]);}}
// Keep partially typed decimal fields intact; the canvas only receives valid values.
$('panel').addEventListener('input',e=>{const el=e.target,key=el.dataset.prop;if(!key||el.tagName==='SELECT'||el.type==='checkbox'||busy)return;try{const v=propertyValue(el);if(editingField!==el){history.push(snapshot());if(history.length>40)history.shift();future=[];editingField=el;}assignProperty(key,v);el.removeAttribute('aria-invalid');renderBoard();$('preflight').textContent=preflight(page(),project.assets).slice(0,5).join(' ');$('undo').disabled=false;scheduleSave();}catch{el.setAttribute('aria-invalid','true');}});
$('panel').addEventListener('focusout',e=>{const el=e.target,key=el.dataset.prop;if(!key)return;if(el.getAttribute('aria-invalid')==='true'){el.value=['bgAngle'].includes(key)?page()[key]:picked()[0]?.[key]??'';el.removeAttribute('aria-invalid');toast('Invalid entry discarded; the last valid value was kept.');}editingField=null;});
$('panel').addEventListener('change',e=>{const el=e.target,key=el.dataset.prop;if(!key||(!['checkbox','color'].includes(el.type)&&el.tagName!=='SELECT'))return;try{const v=propertyValue(el);change(()=>assignProperty(key,v));}catch(err){toast(err.message);renderPanel();}});
$('projectName').addEventListener('input',e=>{autoProjectName=false;project.name=e.target.value.trim().slice(0,120)||'Untitled badges';scheduleSave();});
$('undo').onclick=undo;$('redo').onclick=redo;$('duplicateObject').onclick=duplicate;$('deleteObject').onclick=remove;
function go(n){pageIndex=Math.max(0,Math.min(project.pages.length-1,n));selection=[];render();}
$('pageSelect').onchange=e=>go(Number(e.target.value));$('prevPage').onclick=()=>go(pageIndex-1);$('nextPage').onclick=()=>go(pageIndex+1);
$('addPage').onclick=()=>change(()=>{project.pages.push(newPage(page().badge));pageIndex=project.pages.length-1;selection=[];});
$('duplicatePage').onclick=()=>change(()=>{project.pages.splice(pageIndex+1,0,copyPage(page()));pageIndex++;selection=[];});
$('removePage').onclick=()=>change(()=>{if(project.pages.length===1)throw new Error('Keep at least one page. Delete its objects to clear it.');project.pages.splice(pageIndex,1);pageIndex=Math.min(pageIndex,project.pages.length-1);selection=[];});
$('copies').oninput=e=>{try{const n=number(e.target.value,1,500,true);if(editingField!==e.target){history.push(snapshot());future=[];editingField=e.target;}page().copies=n;e.target.removeAttribute('aria-invalid');$('undo').disabled=false;scheduleSave();}catch{e.target.setAttribute('aria-invalid','true');}};
$('copies').onblur=e=>{e.target.value=page().copies;e.target.removeAttribute('aria-invalid');editingField=null;};
for(const id of ['showGuides','showGrid','showTop'])$(id).onchange=renderBoard;
$('zoom').oninput=fitView;$('fitView').onclick=()=>{$('zoom').value=100;fitView();};new ResizeObserver(fitView).observe($('stage'));
$('selectTool').onclick=()=>{pan=false;$('selectTool').classList.add('active');$('panTool').classList.remove('active');};$('panTool').onclick=()=>{pan=true;$('panTool').classList.add('active');$('selectTool').classList.remove('active');};

let drag;
function point(e){const r=$('board').getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*page().badge.w,y:(e.clientY-r.top)/r.height*page().badge.h};}
$('stage').addEventListener('pointerdown',e=>{if(busy||e.button!==0)return;e.preventDefault();const s=$('stage');if(pan){drag={pan:true,x:e.clientX,y:e.clientY,left:s.scrollLeft,top:s.scrollTop};s.setPointerCapture(e.pointerId);return;}const handle=e.target.closest('[data-handle]')?.dataset.handle,id=e.target.closest('[data-object]')?.dataset.object;
  if(!handle){if(!id){selection=[];render();return;}const o=page().objects.find(o=>o.id===id);if(e.shiftKey||!selection.includes(id))selection=selectedIds(o,e.shiftKey);if(panel==='badge')panel='properties';render();}
  if(!editable().length)return;drag={start:point(e),before:snapshot(),objects:clone(editable()),handle};s.setPointerCapture(e.pointerId);
});
$('stage').addEventListener('pointermove',e=>{if(!drag)return;const s=$('stage');if(drag.pan){s.scrollLeft=drag.left+drag.x-e.clientX;s.scrollTop=drag.top+drag.y-e.clientY;return;}const q=point(e),dx=q.x-drag.start.x,dy=q.y-drag.start.y;
  for(const original of drag.objects){const o=page().objects.find(o=>o.id===original.id);if(drag.handle==='rotate'){const cx=original.x+original.w/2,cy=original.y+original.h/2;let angle=original.rotation+(Math.atan2(q.y-cy,q.x-cx)-Math.atan2(drag.start.y-cy,drag.start.x-cx))*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;o.rotation=angle%360;}
    else if(drag.handle){const a=original.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),lx=dx*c+dy*s,ly=-dx*s+dy*c;let w=drag.handle==='s'?original.w:Math.max(.1,Math.min(2000,original.w+lx)),h=drag.handle==='e'?original.h:Math.max(.1,Math.min(2000,original.h+ly));if(e.shiftKey){const requested=drag.handle==='s'?h/original.h:w/original.w,k=Math.max(.1/original.w,.1/original.h,Math.min(requested,2000/original.w,2000/original.h));w=original.w*k;h=original.h*k;}o.w=w;o.h=h;o.x=Math.max(-2000,Math.min(2000,original.x+(w-original.w)*(c-1)/2-(h-original.h)*s/2));o.y=Math.max(-2000,Math.min(2000,original.y+(w-original.w)*s/2+(h-original.h)*(c-1)/2));if(['text','curve'].includes(o.type)){o.fontSize=Math.max(.1,Math.min(300,original.fontSize*h/original.h));o.arcRadius=Math.max(.1,Math.min(1000,original.arcRadius*w/original.w));}}
    else{o.x=Math.max(-2000,Math.min(2000,original.x+dx));o.y=Math.max(-2000,Math.min(2000,original.y+dy));}
    if(drag.handle&&drag.handle!=='rotate')scaleBorders(o,original,o.w,o.h);
  }renderBoard();
});
function endDrag(cancel=false){if(!drag)return;const d=drag;drag=null;if(!d.pan){if(cancel)restore(d.before);else finish(d.before);}}
$('stage').addEventListener('pointerup',()=>endDrag());$('stage').addEventListener('pointercancel',()=>endDrag(true));
document.addEventListener('keydown',e=>{if($('editorWorkspace').hidden||busy||e.target.closest('input,textarea,select')||document.querySelector('dialog[open]'))return;const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();if(mod&&['z','y','d','a','g','c','v','s'].includes(key))e.preventDefault();if(mod&&key==='z'){e.shiftKey?redo():undo();return;}if(mod&&key==='y')redo();if(mod&&key==='d')duplicate();if(mod&&key==='a'){selection=page().objects.filter(o=>!o.hidden).map(o=>o.id);render();}if(mod&&key==='g')actions[e.shiftKey?'ungroup':'group']();if(mod&&key==='c')clipboard=clone(picked());if(mod&&key==='v'&&clipboard.length)change(()=>{const c=copyPage({...page(),objects:clipboard});c.objects.forEach(o=>{o.x+=2;o.y+=2;});page().objects.push(...c.objects);selection=c.objects.map(o=>o.id);});if(mod&&key==='s')saveProject();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}if(e.key.startsWith('Arrow')){e.preventDefault();const step=e.shiftKey?1:.1;change(()=>editable().forEach(o=>{if(e.key==='ArrowLeft')o.x-=step;if(e.key==='ArrowRight')o.x+=step;if(e.key==='ArrowUp')o.y-=step;if(e.key==='ArrowDown')o.y+=step;}));}});

function saveProject(){download(JSON.stringify(compactProject(project)),safeName(project.name)+'.badge.json','application/json');toast('Project download requested.');}
$('loadSavedWorkspace').onclick=async()=>{if(!await confirmReplace('Download a project backup first. This replaces this tab with the most recently autosaved workspace.'))return;try{const saved=await store.read();if(!saved)throw new Error('There is no saved workspace to load.');const next=validateProject(saved);await installFonts(next.fonts);clearTimeout(saveTimer);project=next;pageIndex=0;selection=[];history=[];future=[];clipboard=[];csv=null;saveBlocked=false;unsaved=false;$('saveRecovery').hidden=true;openWorkspace();$('saveStatus').textContent='Restored latest saved workspace';}catch(e){toast(e.message);}};
async function openLibrary(){$('saveToLibrary').hidden=!hasWorkspace;await renderLibrary();$('libraryDialog').showModal();}
async function renderLibrary(){const entries=await store.list();$('libraryList').innerHTML=entries.length?entries.map(d=>`<section class="library-entry"><strong>${esc(d.name)}</strong><p class="hint">${d.pages} page(s) | ${esc(new Date(d.updated).toLocaleString())}</p><div class="row"><button data-library="open" data-id="${d.id}">Open copy</button><button data-library="backup" data-id="${d.id}">Download backup</button><button data-library="delete" data-id="${d.id}">Delete saved copy</button></div></section>`).join(''):'<p class="hint">No saved designs yet. Save a copy of your current project above.</p>';}
$('saveToLibrary').onclick=async()=>{const button=$('saveToLibrary');button.disabled=true;try{await store.saveDesign(compactProject(project));await renderLibrary();toast('Saved a new library copy on this device.');}catch(e){toast(e.message);}finally{button.disabled=false;}};
$('libraryList').onclick=async e=>{const b=e.target.closest('[data-library]');if(!b)return;b.disabled=true;try{
  if(b.dataset.library==='delete'){if(await confirmReplace('This removes only the library copy. Download a backup first if needed. The open workspace is not affected.','Delete saved copy?','Delete copy')){await store.remove(b.dataset.id);await renderLibrary();}return;}
  const raw=await store.get(b.dataset.id);if(!raw)throw new Error('This copy is no longer in the library.');
  if(b.dataset.library==='backup'){download(JSON.stringify(raw),safeName(raw.name)+'.badge.json','application/json');return;}
  const next=validateProject(raw);if(hasWorkspace&&!await confirmReplace('Open this saved copy? Save the current project first to keep it.'))return;
  await installFonts(next.fonts);$('libraryDialog').close();replaceWorkspace(next);
}catch(err){toast(err.message);}finally{b.disabled=false;}};
function openAudit(){const notes=project.pages.flatMap((p,i)=>preflight(p,project.assets).map(n=>`Page ${i+1} (${p.name}): ${n}`));const fonts=new Set(project.pages.flatMap(p=>p.objects.filter(o=>!o.hidden&&['text','curve'].includes(o.type)&&!project.fonts?.[o.font]).map(o=>o.font)));if(fonts.size)notes.push(`System fonts not embedded in SVG: ${[...fonts].join(', ')}. Import licensed font files for portability; PDF/PNG/JPG contain rasterised text.`);$('auditResults').textContent=`${project.pages.length} page(s) checked. ${notes.length} advisory warning(s).\n\n${notes.length?notes.join('\n\n'):'No automated warnings. Inspect a physical proof and scan every code before production.'}`;$('auditDialog').showModal();}
$('fontInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy)return;const targets=editable().filter(o=>['text','curve'].includes(o.type));setBusy(true);try{const added=await importFont(file),fonts=validateFonts({...project.fonts,...added});await installFonts(added);setBusy(false);change(()=>{project.fonts=fonts;targets.forEach(o=>o.font=Object.keys(added)[0]);});toast('Font imported locally and embedded in this project.');}catch(err){toast(err.message);}finally{setBusy(false);}};
$('saveProject').onclick=saveProject;$('openProject').onclick=()=>$('projectInput').click();
$('newProject').onclick=showCatalogue;
$('projectInput').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy)return;setBusy(true);try{if(file.size>LIMITS.assets*1.5)throw new Error('Project file too large.');const next=validateProject(JSON.parse(await file.text()));if(hasWorkspace&&!await confirmReplace('Save Project first if you need the current design.'))return;await installFonts(next.fonts);replaceWorkspace(next);}catch(err){toast(err.message);}finally{setBusy(false);}};
$('importImage').onclick=()=>$('imageInput').click();$('importPdf').onclick=()=>$('pdfInput').click();
$('uploadImages').onclick=()=>$('imageInput').click();$('uploadPdf').onclick=()=>$('pdfInput').click();
$('importImage').lastChild.textContent='Upload images';$('importImage').title='Upload PNG, JPG, WebP or SVG images (multiple files supported)';
async function upload(files,pdf=false){
  if(!files.length||busy)return;if(files.length>20){toast('Choose at most 20 files per batch.');return;}
  const controller=new AbortController(),dialog=document.createElement('dialog');dialog.innerHTML='<h2>Importing artwork</h2><p role="status">Reading files locally...</p><button type="button">Cancel import</button>';
  const cancel=()=>{controller.abort();dialog.querySelector('button').disabled=true;dialog.querySelector('p').textContent='Cancelling and keeping the previous project...';};
  dialog.querySelector('button').onclick=cancel;dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});document.body.append(dialog);dialog.showModal();
  setBusy(true);const before=snapshot(),oldAssets={...project.assets};
  try{
    const separate=$('importPlacement').value==='pages',count=files.length;
    if((separate&&project.pages.length+count>LIMITS.pages)||(!separate&&page().objects.length+count>LIMITS.objects)||project.pages.reduce((n,p)=>n+p.objects.length,0)+count>LIMITS.total)throw new Error('Not enough project space for this batch. Start a new project or remove items.');
    const progress=message=>{dialog.querySelector('p').textContent=message;};
    const options={signal:controller.signal,progress,remainingItems:Math.min(LIMITS.total-project.pages.reduce((n,p)=>n+p.objects.length,0),separate?LIMITS.pages-project.pages.length:LIMITS.objects-page().objects.length),remainingBytes:LIMITS.assets-Object.values(project.assets).reduce((n,a)=>n+a.data.length,0),remainingPixels:LIMITS.importPixels-Object.values(project.assets).reduce((n,a)=>n+a.w*a.h,0)};
    const assets=pdf?await importPDFs(files,progress,options):await importImages(files,options);controller.signal.throwIfAborted();
    for(const a of assets){if(separate){project.pages.push(newPage(page().badge));pageIndex=project.pages.length-1;page().name=a.name.slice(0,70);}const id=uid();project.assets[id]={data:a.data,w:a.w,h:a.h};const o=makeObject('image',page());o.asset=id;o.name=a.name;const k=Math.min(page().badge.safeW/a.w,page().badge.safeH/a.h);o.w=a.w*k;o.h=a.h*k;alignObjects([o],page().badge,'center');page().objects.push(o);selection=[o.id];}
    if(autoProjectName&&!Object.keys(oldAssets).length)project.name=uploadName(files);
    panel='properties';setBusy(false);finish(before);toast(`Imported ${assets.length} image(s)${pdf?' at 300 DPI':''}.`);
  }catch(err){project.assets=oldAssets;setBusy(false);restore(before);toast(controller.signal.aborted?'Import cancelled. Previous project kept.':err.message);}
  finally{dialog.close();dialog.remove();setBusy(false);}
}
$('imageInput').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';upload(files);};$('pdfInput').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';upload(files,true);};
$('stage').addEventListener('dragover',e=>e.preventDefault());$('stage').addEventListener('drop',e=>{e.preventDefault();const files=Array.from(e.dataTransfer.files);if(files.some(f=>f.type==='application/pdf')&&files.some(f=>f.type!=='application/pdf')){toast('Drop PDF and image batches separately.');return;}upload(files,files[0]?.type==='application/pdf');});
$('csvInput').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>1024*1024)throw new Error('CSV exceeds 1 MB.');const next=parseCSV(await f.text());if(!next.rows.length||next.rows.length>100)throw new Error('CSV must have 1-100 data rows.');csv=next;panel='batch';renderPanel();}catch(err){toast(err.message);}};

let cropState;
async function openCrop(){const o=picked()[0];if(o?.type!=='image'||o.locked)return;const asset=project.assets[o.asset],im=o.photoRotation?await photoCanvas(asset,o.photoRotation,16000):await loadImage(asset.data);cropState={id:o.id,im,original:im,rotation:0,crop:clone(o.crop),sourceRotation:o.photoRotation||0};$('cropZoom').value=100;$('cropPanX').value=$('cropPanY').value=0;$('cropShape').value=o.cropShape;$('cropDialog').showModal();drawCrop();}
function drawCrop(){if(!cropState)return;const canvas=$('cropCanvas'),ctx=canvas.getContext('2d'),im=cropState.im,k=Math.min(canvas.width/im.width,canvas.height/im.height)*Number($('cropZoom').value)/100,w=im.width*k,h=im.height*k,x=(canvas.width-w)/2+Number($('cropPanX').value)/100*Math.max(0,(w-canvas.width)/2),y=(canvas.height-h)/2+Number($('cropPanY').value)/100*Math.max(0,(h-canvas.height)/2);cropState.view={x,y,w,h};$('cropZoomLabel').textContent=$('cropZoom').value+'%';ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,x,y,w,h);const c=cropState.crop;ctx.fillStyle='#102f4455';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.beginPath();if($('cropShape').value==='round')ctx.ellipse(x+(c.x+c.w/2)*w,y+(c.y+c.h/2)*h,c.w*w/2,c.h*h/2,0,0,Math.PI*2);else ctx.rect(x+c.x*w,y+c.y*h,c.w*w,c.h*h);ctx.clip();ctx.drawImage(im,x,y,w,h);ctx.restore();ctx.strokeStyle='#20c28c';ctx.lineWidth=2;ctx.strokeRect(x+c.x*w,y+c.y*h,c.w*w,c.h*h);}
function cropPoint(e){const r=$('cropCanvas').getBoundingClientRect(),v=cropState.view;return {x:Math.max(0,Math.min(1,((e.clientX-r.left)/r.width*650-v.x)/v.w)),y:Math.max(0,Math.min(1,((e.clientY-r.top)/r.height*400-v.y)/v.h))};}
$('cropCanvas').onpointerdown=e=>{if(!cropState)return;cropState.start=cropPoint(e);$('cropCanvas').setPointerCapture(e.pointerId);};
$('cropCanvas').onpointermove=e=>{if(!cropState?.start)return;let ratio=$('cropAspect').value;ratio=ratio==='free'?null:(ratio==='badge'?page().badge.faceW/page().badge.faceH:Number(ratio))*cropState.im.height/cropState.im.width;const next=cropSelection(cropState.start,cropPoint(e),ratio);if(next)cropState.crop=next;drawCrop();};
$('cropCanvas').onpointerup=()=>{if(cropState)cropState.start=null;};$('cropCanvas').onpointercancel=()=>{if(cropState)cropState.start=null;};$('cropShape').onchange=drawCrop;
$('resetCrop').onclick=()=>{cropState.crop={x:0,y:0,w:1,h:1};$('cropZoom').value=100;$('cropPanX').value=$('cropPanY').value=0;drawCrop();};
for(const id of ['cropZoom','cropPanX','cropPanY'])$(id).oninput=drawCrop;
function rotateCropView(clockwise){if(!cropState)return;const c=cropState;try{const rotation=(c.rotation+(clockwise?90:270))%360,source=c.original,swap=rotation%180!==0,canvas=canvasFor(swap?source.height:source.width,swap?source.width:source.height),ctx=canvas.getContext('2d');ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(source,-source.width/2,-source.height/2);if(c.im!==c.original)c.im.width=c.im.height=0;c.im=canvas;c.rotation=rotation;c.crop=rotateCrop(c.crop,clockwise);drawCrop();}catch(e){toast(e.message);}}
$('cropRotateLeft').onclick=()=>rotateCropView(false);$('cropRotateRight').onclick=()=>rotateCropView(true);
$('applyCrop').onclick=()=>{if(!cropState)return;change(()=>{const o=page().objects.find(o=>o.id===cropState.id);o.photoRotation=(cropState.sourceRotation+cropState.rotation)%360;o.crop=clone(cropState.crop);o.cropShape=$('cropShape').value;});$('cropDialog').close();};
$('cropDialog').addEventListener('close',()=>{if(cropState?.im!==cropState?.original&&cropState?.im)cropState.im.width=cropState.im.height=0;if(cropState?.original instanceof HTMLCanvasElement)cropState.original.width=cropState.original.height=0;cropState=null;});
async function removeColour(){const o=picked()[0];if(o?.type!=='image'||o.locked)return;const colour=$('removeColour').value,t=number($('removeTolerance').value,0,255),target=[1,3,5].map(i=>parseInt(colour.slice(i,i+2),16)),a=project.assets[o.asset];setBusy(true);let c;try{const im=await loadImage(a.data);c=canvasFor(a.w,a.h);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;for(let i=0;i<d.length;i+=4){if(Math.abs(target[0]-d[i])<=t&&Math.abs(target[1]-d[i+1])<=t&&Math.abs(target[2]-d[i+2])<=t)d[i+3]=0;if(i%524288===0)await new Promise(resolve=>setTimeout(resolve,0));}ctx.putImageData(pixels,0,0);const id=uid(),asset={data:c.toDataURL('image/png'),w:a.w,h:a.h};setBusy(false);change(()=>{project.assets[id]=asset;o.asset=id;});}finally{if(c)c.width=c.height=0;setBusy(false);}}

let exportQuantities={},exportPreviewIndex=0,exportPreview=null;
function renderSheetPreview(){
  $('sheetNavigation').hidden=!exportPreview;
  if(!exportPreview){$('sheetPreview').innerHTML='';return;}
  const {plan,options:o}=exportPreview;
  exportPreviewIndex=Math.min(exportPreviewIndex,plan.sheets.length-1);
  const sheet=plan.sheets[exportPreviewIndex];
  $('sheetPreviewPage').textContent=`Sheet ${exportPreviewIndex+1} of ${plan.sheets.length} - ${sheet.length} copies`;
  $('previousSheet').disabled=exportPreviewIndex===0;
  $('nextSheet').disabled=exportPreviewIndex===plan.sheets.length-1;
  $('sheetPreview').innerHTML=`<p class="hint">Placement preview, not artwork. Exact cut sizes; no scaling. ${o.packing==='smart'?'Space-saving rectangle packing may reorder designs; R marks a rotated copy. This is a heuristic, not guaranteed optimal nesting.':'Rows preserve design order without rotation.'}</p><svg role="img" aria-label="Sheet ${exportPreviewIndex+1} placement preview" viewBox="0 0 ${o.w} ${o.h}"><rect width="${o.w}" height="${o.h}" fill="white" stroke="#b0bfba"/>${sheet.map(item=>`<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${item.page%2?'#dfebfa':'#ddefe9'}" stroke="#136d60" stroke-width=".4"/><text x="${item.x+item.w/2}" y="${item.y+item.h/2}" dominant-baseline="central" text-anchor="middle" font-family="Arial" font-size="${Math.min(8,item.w/2,item.h/2)}">${project.pages.findIndex(p=>p.id===plan.pages[item.page].id)+1}${item.rotated?' R':''}</text>`).join('')}</svg>`;
}
$('previousSheet').onclick=()=>{if(exportPreviewIndex>0)exportPreviewIndex--;renderSheetPreview();};
$('nextSheet').onclick=()=>{if(exportPreview&&exportPreviewIndex<exportPreview.plan.sheets.length-1)exportPreviewIndex++;renderSheetPreview();};
const exportPages=()=>$('exportScope').value==='current'?[page()]:project.pages;
function renderExportQuantities(){
  $('exportQuantities').innerHTML=exportPages().map(p=>`<div class="quantity-row"><label>${project.pages.indexOf(p)+1}. ${esc(p.name)}<small>${p.badge.w} x ${p.badge.h} mm cut size</small><input type="number" min="0" max="500" step="1" data-export-copies="${p.id}" aria-label="Copies for design ${project.pages.indexOf(p)+1}" value="${esc(exportQuantities[p.id]??p.copies)}"></label><div><span data-capacity="${p.id}"></span><button data-fill-sheet="${p.id}">Fill one sheet</button></div></div>`).join('');
}
function exportOptions(){const format=$('exportFormat').value;return {format,dpi:number($('exportDpi').value,300,1200,true),current:format!=='pdf'||$('exportScope').value==='current'?pageIndex:null,...(format==='pdf'?{w:number($('sheetW').value,10,1000),h:number($('sheetH').value,10,1000),margin:number($('sheetMargin').value,0,100),gap:number($('sheetGap').value,0,100),layout:$('exportLayout').value,packing:$('exportPacking').value,rotate:$('exportRotate').checked,quantities:{...exportQuantities}}:{}),cut:$('exportCut').checked};}
function exportSummary(){
  if(exportController)return;const pdf=$('exportFormat').value==='pdf';
  for(const id of ['sheetPreset','sheetOrientation','sheetW','sheetH','sheetMargin','sheetGap','exportScope','exportLayout','exportPacking','exportQuantityControls'])$(id).disabled=!pdf;
  $('exportRotate').disabled=!pdf||$('exportPacking').value!=='smart';
  $('exportDpi').disabled=$('exportFormat').value==='svg';exportPreview=null;renderSheetPreview();
  for(const label of $('exportQuantities').querySelectorAll('[data-capacity]'))label.textContent='';
  try{
    const o=exportOptions();
    if(pdf)for(const p of exportPages()){const capacity=sheetCapacity(p.badge,o.w,o.h,o.margin,o.gap);$('exportQuantities').querySelector(`[data-capacity="${p.id}"]`).textContent=o.packing==='smart'?'Use Fill one sheet to calculate (up to 500).':`${capacity} copies / full sheet`;}
    const plan=pdf?printPlan(project,o):null,pages=plan?plan.pages:[page()];
    const warnings=pages.reduce((n,p)=>n+preflight(p,project.assets).length,0);
    $('exportSummary').textContent=(plan?`${plan.total} copies on ${plan.sheets.length} PDF sheet(s). ${o.w} x ${o.h} mm paper, ${o.dpi} DPI. Copies per sheet: ${plan.sheets.map(s=>s.length).join(', ')}.`:'Single current badge only. Choose PDF for gang-up / multiple copies.')+(warnings?` ${warnings} advisory warning(s): use Check all pages before production.`:'');
    if(plan){exportPreview={plan,options:o};renderSheetPreview();}
    $('runExport').disabled=false;
  }catch(err){$('exportSummary').textContent=err.message;$('runExport').disabled=true;}
}
$('export').onclick=()=>{if(busy)return;exportPreviewIndex=0;$('exportProgress').value=0;exportQuantities=Object.fromEntries(project.pages.map(p=>[p.id,p.copies]));$('exportCopies').value=page().copies;renderExportQuantities();$('exportDialog').showModal();exportSummary();};
$('applyExportCopies').onclick=()=>{if(exportController)return;try{const n=number($('exportCopies').value,0,500,true);exportPages().forEach(p=>exportQuantities[p.id]=n);renderExportQuantities();exportSummary();}catch(e){$('exportSummary').textContent=e.message;}};
$('exportQuantities').onclick=e=>{const b=e.target.closest('[data-fill-sheet]');if(!b||exportController)return;try{const o=exportOptions(),p=project.pages.find(p=>p.id===b.dataset.fillSheet),n=o.packing==='smart'?printPlan({pages:[p]},{...o,current:null,quantities:{[p.id]:500}}).sheets[0].length:sheetCapacity(p.badge,o.w,o.h,o.margin,o.gap);if(!n)throw new Error('This design does not fit the selected paper at exact size.');if(n>500)throw new Error('A full sheet exceeds 500 copies; enter a smaller quantity.');exportQuantities[p.id]=n;renderExportQuantities();exportSummary();}catch(err){$('exportSummary').textContent=err.message;}};
$('exportScope').onchange=()=>{renderExportQuantities();exportSummary();};
$('sheetPreset').onchange=()=>{const size=PAPER_SIZES[$('sheetPreset').value];if(size)[$('sheetW').value,$('sheetH').value]=$('sheetOrientation').value==='landscape'?[size[1],size[0]]:size;exportSummary();};
$('sheetOrientation').onchange=()=>{const w=Number($('sheetW').value),h=Number($('sheetH').value);if(Number.isFinite(w)&&Number.isFinite(h))[$('sheetW').value,$('sheetH').value]=$('sheetOrientation').value==='landscape'?[Math.max(w,h),Math.min(w,h)]:[Math.min(w,h),Math.max(w,h)];exportSummary();};
$('exportDialog').addEventListener('input',e=>{if(exportController)return;if(e.target.dataset.exportCopies)exportQuantities[e.target.dataset.exportCopies]=e.target.value;if(['sheetW','sheetH'].includes(e.target.id)){$('sheetPreset').value='custom';$('sheetOrientation').value=Number($('sheetW').value)>Number($('sheetH').value)?'landscape':'portrait';}exportSummary();});
$('exportDialog').addEventListener('change',exportSummary);
$('runExport').onclick=async()=>{
  if(exportController)return;
  const controls=[...$('exportDialog').querySelectorAll('input,select,button,fieldset')].filter(e=>e.id!=='cancelExport'),disabled=controls.map(e=>e.disabled);
  try{
    const options=exportOptions();exportController=new AbortController();setBusy(true);
    controls.forEach(e=>e.disabled=true);outputActivity.start();$('exportDialog').setAttribute('aria-busy','true');
    await exportProject(compactProject(project),options,(n,msg)=>{outputActivity.update(n,msg);$('exportSummary').textContent=msg;},exportController.signal);
    outputActivity.finish('done','Download requested. Check your browser downloads and print at 100% / Actual Size.');$('exportSummary').textContent='Output created successfully.';toast('Output download requested.');
  }catch(err){const cancelled=exportController?.signal.aborted;outputActivity.finish(cancelled?'cancelled':'error',cancelled?'No new output was downloaded.':err.message);$('exportSummary').textContent=err.message;}
  finally{exportController=null;setBusy(false);controls.forEach((e,i)=>e.disabled=disabled[i]);$('exportDialog').removeAttribute('aria-busy');}
};
$('cancelExport').onclick=()=>{if(exportController)exportController.abort();else $('exportDialog').close();};$('exportDialog').addEventListener('cancel',e=>{if(exportController){e.preventDefault();exportController.abort();}});

setBusy(true);
try{const saved=await store.read();if(saved){const next=validateProject(saved);await installFonts(next.fonts);project=next;hasWorkspace=true;$('saveStatus').textContent='Restored local workspace';}}catch(e){saveBlocked=true;$('saveStatus').textContent='Restore failed - Open a project backup';toast(e.message);}finally{setBusy(false);catalogueStatus();}
document.dispatchEvent(new Event('badge-studio-ready'));
autoProjectName=!hasWorkspace;
registerJobAdapter('badge',async plan=>{
  if(busy)throw new Error('Wait for the current operation to finish.');
  const preset=PRESETS.find(p=>p.id===plan.preset);if(!preset)throw new Error('Choose a supported preset.');
  if(page().objects.length&&!await confirmReplace('Change the current design size? Existing artwork keeps its physical size and position. Review its fit afterwards.','Change dimensions?','Apply dimensions'))throw new Error('Settings were not changed.');
  const before=snapshot();
  page().badge=clone(preset);if(plan.copies!==null)page().copies=plan.copies;
  if(plan.paper){$('sheetPreset').value=PAPER_SIZES[plan.paper]?plan.paper:'custom';const size=plan.landscape?[...plan.paperSize].reverse():plan.paperSize;[$('sheetW').value,$('sheetH').value]=size;$('sheetOrientation').value=plan.landscape?'landscape':'portrait';}
  openWorkspace();finish(before);
});
