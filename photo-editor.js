import {clone} from './core.js';
import {frameCrop,framingValues,faceCrop,rotatedSize} from './photo.js';
import {photoCanvas,detectFaces} from './faces.js';

export function installPhotoEditor({getProject,change,setBusy,toast}){
  const d=document.createElement('dialog');d.id='photoDialog';
  d.innerHTML=`<div class="dialog-head"><h2>Photo framing / local face detection</h2><button id="photoClose">Close</button></div><p class="hint">Drag the photo inside its fixed frame. Changes affect this photo only, not badge dimensions. Originals are preserved. Face detection suggests a crop; it does not identify people.</p><canvas id="photoPreview" width="650" height="440" style="width:100%;touch-action:none;background:#eef2f4"></canvas><div class="form-grid"><label>Photo zoom (%)<input id="photoZoom" type="number" min="100" max="600" step="1" value="100"></label><label>Zoom slider<input id="photoZoomSlider" type="range" min="100" max="600" value="100"></label><label>Horizontal position<input id="photoX" type="range" min="-100" max="100" value="0"></label><label>Vertical position<input id="photoY" type="range" min="-100" max="100" value="0"></label></div><div class="row"><button id="photoRotate">Rotate photo +90</button><button id="photoReset">Reset framing</button><button id="photoDetect">Detect faces locally</button></div><label>Face to frame<select id="photoFace"><option value="all">All detected faces</option></select></label><p id="photoStatus" class="notice" role="status">No photos leave this device. Best with upright, front-facing photos.</p><div class="actions"><button id="photoBulk">Auto-frame all unlocked photos in project</button><button id="photoStop" hidden>Cancel detection</button><button id="photoApply" class="primary">Apply to this photo</button></div>`;
  document.body.append(d);const $=id=>d.querySelector('#'+id);
  for(const id of ['photoZoom','photoZoomSlider','photoX','photoY'])$(id).step='any';
  let state=null,controller=null,drag=null,working=false;
  function status(s){$('photoStatus').textContent=s;}
  function locked(v){working=v;for(const el of d.querySelectorAll('button,input,select'))el.disabled=v;$('photoStop').hidden=!v||!controller;$('photoStop').disabled=false;if(!v){const z=Number($('photoZoom').value);$('photoApply').disabled=!Number.isFinite(z)||z<100||z>600;}}
  function values(){return {zoom:Number($('photoZoom').value),x:Number($('photoX').value),y:Number($('photoY').value)};}
  function controls(c){const a=rotatedSize(state.asset,state.rotation),v=framingValues(c,a.w,a.h,state.o.w/state.o.h);$('photoZoom').value=$('photoZoomSlider').value=v.zoom;$('photoX').value=v.x;$('photoY').value=v.y;}
  function draw(){
    if(!state?.canvas)return;const c=$('photoPreview'),ctx=c.getContext('2d'),o=state.o,im=state.canvas,s=Math.min(610/o.w,400/o.h),w=o.w*s,h=o.h*s,x=(650-w)/2,y=(440-h)/2,r=state.crop;
    state.view={x,y,w,h};ctx.clearRect(0,0,650,440);ctx.save();ctx.beginPath();if(o.cropShape==='round')ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);else ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='white';ctx.fillRect(x,y,w,h);
    const filters={none:'',grayscale:'grayscale(1)',sepia:'sepia(1)',invert:'invert(1)'};ctx.filter=`brightness(${o.brightness}%) contrast(${o.contrast}%) saturate(${o.saturation}%) ${filters[o.filter]||''}`;
    ctx.drawImage(im,r.x*im.width,r.y*im.height,r.w*im.width,r.h*im.height,x,y,w,h);ctx.restore();ctx.strokeStyle='#136d60';ctx.strokeRect(x,y,w,h);
  }
  function update(){try{const v=values(),a=rotatedSize(state.asset,state.rotation);if($('photoZoom').value.trim()==='')throw new Error('Enter zoom from 100 to 600%.');state.crop=frameCrop(a.w,a.h,state.o.w/state.o.h,v.zoom,v.x,v.y);$('photoZoomSlider').value=v.zoom;$('photoApply').disabled=false;draw();}catch(e){status(e.message);$('photoApply').disabled=true;}}
  for(const id of ['photoZoom','photoX','photoY'])$(id).oninput=update;
  $('photoZoomSlider').oninput=()=>{$('photoZoom').value=$('photoZoomSlider').value;update();};
  async function refresh(){const canvas=await photoCanvas(state.asset,state.rotation);if(state.canvas)state.canvas.width=state.canvas.height=0;state.canvas=canvas;draw();}
  function reset(){const a=rotatedSize(state.asset,state.rotation);state.crop=frameCrop(a.w,a.h,state.o.w/state.o.h);controls(state.crop);$('photoApply').disabled=false;draw();}
  $('photoReset').onclick=reset;
  $('photoRotate').onclick=async()=>{locked(true);try{state.rotation=(state.rotation+90)%360;state.faces=[];$('photoFace').innerHTML='<option value="all">All detected faces</option>';reset();await refresh();status('Photo rotated; detect faces again if needed.');}catch(e){status(e.message);}finally{locked(false);}};
  function useFaces(){if(!state.faces?.length)return;const id=$('photoFace').value,faces=id==='all'?state.faces:[state.faces[Number(id)]],a=rotatedSize(state.asset,state.rotation),crop=faceCrop(faces.map(f=>({...f,x:f.x*a.w,y:f.y*a.h,w:f.w*a.w,h:f.h*a.h})),a.w,a.h,state.o.w/state.o.h);if(!crop){status('All faces cannot fit this frame without clipping. Choose one face, widen the frame or use Contain in Image fit. Crop unchanged.');return;}state.crop=crop;controls(state.crop);draw();status(`${faces.length} face(s) included in suggested crop. Check the preview before applying.`);}
  $('photoFace').onchange=useFaces;
  $('photoDetect').onclick=async()=>{
    controller=new AbortController();locked(true);status('Detecting locally...');
    try{state.faces=await detectFaces(state.asset,state.rotation,controller.signal);$('photoFace').innerHTML='<option value="all">All detected faces</option>'+state.faces.map((f,i)=>`<option value="${i}">Face ${i+1} (left ${Math.round(f.x*100)}%, top ${Math.round(f.y*100)}%)</option>`).join('');if(state.faces.length)useFaces();else status('No confident face found. Framing was not changed; use manual zoom and position.');}
    catch(e){status(e.message);}finally{controller=null;locked(false);}
  };
  $('photoBulk').onclick=async()=>{
    const project=getProject(),targets=project.pages.flatMap(p=>p.objects.filter(o=>o.type==='image'&&!o.locked&&!o.hidden));
    controller=new AbortController();locked(true);setBusy(true);const edits=[];let misses=0;
    try{
      for(const [i,o] of targets.entries()){
        status(`Detecting photo ${i+1}/${targets.length}. Changes apply together when finished.`);
        const a=project.assets[o.asset],rotation=o.photoRotation||0,faces=await detectFaces(a,rotation,controller.signal),size=rotatedSize(a,rotation);
        if(!faces.length){misses++;continue;}
        const crop=faceCrop(faces.map(f=>({...f,x:f.x*size.w,y:f.y*size.h,w:f.w*size.w,h:f.h*size.h})),size.w,size.h,o.w/o.h);
        if(crop)edits.push({o,crop});else misses++;
      }
      if(controller.signal.aborted)throw new Error('Face framing cancelled.');
      setBusy(false);change(()=>edits.forEach(({o,crop})=>{o.crop=crop;o.fit='cover';}));
      status(`Auto-framed ${edits.length} photo(s); ${misses} unchanged (no confident face, or group could not fit). Undo reverses the whole batch.`);
      const own=edits.find(e=>e.o.id===state.id);if(own){state.rotation=own.o.photoRotation||0;state.crop=clone(own.crop);controls(state.crop);await refresh();}
    }catch(e){status(e.message+' No batch changes applied.');}finally{controller=null;setBusy(false);locked(false);}
  };
  $('photoStop').onclick=()=>controller?.abort();
  $('photoApply').onclick=()=>{change(()=>{const o=getProject().pages.flatMap(p=>p.objects).find(o=>o.id===state.id);if(!o||o.locked)throw new Error('Photo is no longer editable.');o.crop=clone(state.crop);o.photoRotation=state.rotation;o.fit='cover';});d.close();};
  $('photoClose').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(working){e.preventDefault();controller?.abort();}});
  d.addEventListener('close',()=>{controller?.abort();if(state?.canvas)state.canvas.width=state.canvas.height=0;state=null;drag=null;});
  $('photoPreview').onpointerdown=e=>{if(!state||controller)return;drag={x:e.clientX,y:e.clientY,crop:clone(state.crop)};$('photoPreview').setPointerCapture(e.pointerId);};
  $('photoPreview').onpointermove=e=>{if(!drag||!state)return;const r=$('photoPreview').getBoundingClientRect(),v=state.view,c=drag.crop;state.crop={...c,x:Math.max(0,Math.min(1-c.w,c.x-(e.clientX-drag.x)*650/r.width/v.w*c.w)),y:Math.max(0,Math.min(1-c.h,c.y-(e.clientY-drag.y)*440/r.height/v.h*c.h))};controls(state.crop);draw();};
  $('photoPreview').onpointerup=$('photoPreview').onpointercancel=()=>drag=null;
  return {open:async o=>{if(o?.type!=='image'||o.locked){toast('Select an unlocked photo first.');return;}try{const asset=getProject().assets[o.asset];state={id:o.id,o:clone(o),asset,rotation:o.photoRotation||0,crop:clone(o.crop),faces:[]};controls(state.crop);$('photoFace').innerHTML='<option value="all">All detected faces</option>';update();await refresh();status('Drag to position; zoom changes only this photo inside its fixed frame.');d.showModal();}catch(e){toast(e.message);}}};
}
