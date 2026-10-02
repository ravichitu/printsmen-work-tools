import {PRESETS,PRESET_GROUPS,clone,esc,newPage,newProject} from './core.js';

function productIllustration(b){
  return `<span class="catalogue-art" aria-hidden="true"><span class="catalogue-shape ${b.shape==='round'?'is-round':''} ${b.id==='polaroid'?'is-polaroid':''}" style="--shape-width:${Math.min(170,76*b.w/b.h)}px;--shape-height:${Math.min(76,170*b.h/b.w)}px">${b.id==='polaroid'?'<span></span>':'<span>Pm</span>'}</span></span>`;
}

export function catalogueCategories(){
  return PRESET_GROUPS.map((group,index)=>`<button type="button" class="catalogue-card catalogue-category" data-open-catalogue="${index}">
    ${productIllustration(PRESETS.find(p=>p.id===group.ids[0]))}
    <strong>${esc(group.name)}</strong><span class="catalogue-category-count">${group.ids.length} ${group.ids.length===1?'size':'sizes'} <span aria-hidden="true">&rarr;</span></span>
  </button>`).join('')+`<button type="button" class="catalogue-card catalogue-category" data-open-catalogue="custom"><span class="catalogue-art catalogue-custom-art" aria-hidden="true">+</span><strong>Custom size</strong><span class="catalogue-category-count">Your dimensions <span aria-hidden="true">&rarr;</span></span></button>`;
}

export function catalogueMarkup(){
  return PRESET_GROUPS.map((group,index)=>`<section class="catalogue-group" data-catalogue-group="${index}" aria-labelledby="catalogue-group-${index}">
    <div class="catalogue-group-heading"><h2 id="catalogue-group-${index}">${esc(group.name)}</h2><span>${group.ids.length} ${group.ids.length===1?'size':'sizes'}</span></div>
    <div class="catalogue-grid">${group.ids.map(id=>{
      const b=PRESETS.find(p=>p.id===id);
      const size=(w,h)=>b.shape==='round'?`${w} mm diameter`:`${w} x ${h} mm`;
      return `<button type="button" class="catalogue-card" data-start-preset="${b.id}">
        ${productIllustration(b)}
        <strong>${esc(b.name)}</strong><span class="catalogue-measurements">Face: ${size(b.faceW,b.faceH)}<br>Cut: ${size(b.w,b.h)}<br>Safe: ${size(b.safeW,b.safeH)}</span><span class="catalogue-start">Create design <span aria-hidden="true">&rarr;</span></span>
      </button>`;
    }).join('')}</div></section>`).join('');
}

export function projectFromCatalogue(id){
  const preset=id==='custom'?{id:'custom',name:'Custom badge',shape:'rect',w:60,h:60,faceW:60,faceH:60,safeW:56,safeH:56,cornerRadius:0}:PRESETS.find(p=>p.id===id);
  if(!preset)throw new Error('Choose an available catalogue size.');
  const project=newProject();
  project.name=preset.name;
  project.pages=[newPage(clone(preset))];
  project.pages[0].name=preset.name;
  return project;
}
