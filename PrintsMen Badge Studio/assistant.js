import {planJob,validatePlan,jobRoute,TOOL_ROUTES} from './automation-core.js';
const adapters=new Map(),key='printsmen-job-plan-v1';
export function outputStatus(progress){
  const panel=document.createElement('section');panel.className='pm-output-status';panel.hidden=true;
  panel.innerHTML='<span class="pm-output-orbit" aria-hidden="true"></span><div><strong>Creating your output</strong><p role="status" aria-live="polite"></p></div>';
  progress.before(panel);panel.append(progress);
  const title=panel.querySelector('strong'),message=panel.querySelector('p');
  return {
    start(){panel.hidden=false;panel.dataset.state='working';panel.setAttribute('aria-busy','true');title.textContent='Creating your output';this.update(null,'Preparing artwork. Keep this window open.');},
    update(value,text){if(Number.isFinite(value))progress.value=Math.max(0,Math.min(1,value));else progress.removeAttribute('value');message.textContent=text||'Processing artwork...';},
    finish(state,text){panel.dataset.state=state;panel.removeAttribute('aria-busy');title.textContent=state==='done'?'Output ready':state==='cancelled'?'Output cancelled':'Output needs attention';progress.value=state==='done'?1:0;message.textContent=text;}
  };
}
export function registerJobAdapter(name,apply){adapters.set(name,apply);}
export function confirmAction(message,accept='Continue'){
  return new Promise(resolve=>{
    const box=document.createElement('dialog');box.className='pm-assistant';
    const title=document.createElement('h2');title.textContent='Review before continuing';
    const detail=document.createElement('p');detail.textContent=message;
    const yes=document.createElement('button');yes.textContent=accept;
    const no=document.createElement('button');no.textContent='Cancel';
    const finish=value=>{box.close();box.remove();resolve(value);};
    yes.onclick=()=>finish(true);no.onclick=()=>finish(false);box.oncancel=e=>{e.preventDefault();finish(false);};
    box.append(title,detail,yes,no);document.body.append(box);box.showModal();no.focus();
  });
}
const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('assistant.css',import.meta.url);document.head.append(style);
const open=document.createElement('button');open.className='pm-assist-open';open.type='button';open.textContent='Job Assistant';
const dialog=document.createElement('dialog');dialog.className='pm-assistant';dialog.innerHTML='<h2>Customised Studio Job Assistant</h2><p class="pm-assist-note">Offline command assistant, not a generative AI model. Files stay local. Manual controls always remain available.</p><label>Describe your job<textarea aria-label="Describe your job" maxlength="2000" placeholder="100 round badges 58 mm on A4"></textarea></label><button data-plan>Review job</button><button data-example>Box example</button><pre role="status">Tell me the product, dimensions with units, paper and copies.</pre><button class="pm-assist-primary" data-apply disabled>Apply reviewed settings / open tool</button><button data-close>Close</button>';
document.body.append(open,dialog);const text=dialog.querySelector('textarea'),status=dialog.querySelector('pre'),apply=dialog.querySelector('[data-apply]');let plan=null;
const recipeKey='printsmen-job-recipes-v1',recipes=document.createElement('select'),saveRecipe=document.createElement('button');
recipes.setAttribute('aria-label','Saved job recipes');saveRecipe.textContent='Save reviewed recipe';
dialog.querySelector('[data-close]').before(recipes,saveRecipe);
function recipeList(){try{const list=JSON.parse(localStorage.getItem(recipeKey)||'[]');return Array.isArray(list)?list.filter(x=>typeof x==='string'&&x.length<=2000).slice(0,10):[];}catch{return [];}}
function renderRecipes(){recipes.replaceChildren();for(const [value,label] of [['','Saved recipes (local, no artwork)'],...recipeList().map(prompt=>[prompt,prompt.slice(0,80)])]){const option=document.createElement('option');option.value=value;option.textContent=label;recipes.append(option);}}
recipes.onchange=()=>{if(recipes.value){text.value=recipes.value;review();}};
saveRecipe.onclick=()=>{try{const checked=plan&&validatePlan(plan);if(!checked||checked.missing.length)throw new Error('Review a complete job first.');const list=recipeList().filter(p=>p!==checked.prompt);if(list.length>=10)throw new Error('Ten recipes are already saved. Existing recipes have been kept.');localStorage.setItem(recipeKey,JSON.stringify([checked.prompt,...list]));renderRecipes();status.textContent='Recipe saved on this browser. No artwork or login information is stored in it.';}catch(e){status.textContent=e.message;}};
renderRecipes();
open.onclick=()=>{dialog.showModal();text.focus();};dialog.querySelector('[data-close]').onclick=()=>dialog.close();
dialog.querySelector('[data-example]').onclick=()=>{text.value='Make 4 boxes 80 x 120 x 30 mm on 13x19';review();};
text.oninput=()=>{plan=null;apply.disabled=true;};
function review(){try{plan=planJob(text.value);const title=plan.tool==='products'?'Box / Dangler / Mockup':plan.tool==='badge'?'Customised Designer':TOOL_ROUTES.find(t=>t.id===plan.tool)?.name||'Tool not selected';status.textContent=[title,plan.size?'Dimensions: '+Object.values(plan.size).join(' x ')+' mm':'',plan.copies!==null?'Copies: '+plan.copies:'',plan.paper?'Paper: '+plan.paper+' ('+plan.paperSize.join(' x ')+' mm)':'Paper: keep manual selection',...plan.notes,...plan.missing.map(s=>'NEEDED: '+s),'No upload, deletion or export will run automatically.'].filter(Boolean).join('\n');apply.disabled=plan.missing.length>0;}catch(e){plan=null;apply.disabled=true;status.textContent=e.message;}}
dialog.querySelector('[data-plan]').onclick=review;
apply.onclick=async()=>{if(!plan)return;apply.disabled=true;try{const checked=validatePlan(plan);if(checked.missing.length)throw new Error(checked.missing.join('\n'));const adapter=adapters.get(checked.tool);if(adapter){await adapter(checked);status.textContent='Settings prepared. Review the preview, then upload artwork or export manually. Undo is available in the editor.';}else{const route=jobRoute(checked),target=new URL(route,import.meta.url);if(location.pathname===target.pathname){const item=TOOL_ROUTES.find(t=>t.id===checked.tool),tab=document.querySelector('.tab[data-page="'+item?.page+'"]');if(!tab||window.PRINTSMEN_ALLOWED_PAGES&&!window.PRINTSMEN_ALLOWED_PAGES.includes(item.page))throw new Error('This tool is not available in the current licence.');tab.click();status.textContent='Tool opened. Enter and verify dimensions using its manual controls.';}else{if(!await confirmAction('Open '+route+'? Save any current work before changing workspace.','Open workspace'))return;sessionStorage.setItem(key,JSON.stringify({expires:Date.now()+10*60000,plan:checked}));location.assign(target.href);}}}catch(e){status.textContent=e.message;}finally{apply.disabled=!plan||plan.missing.length>0;}};
try{const raw=sessionStorage.getItem(key);if(raw){sessionStorage.removeItem(key);const saved=JSON.parse(raw);if(saved.expires>Date.now()){const checked=validatePlan(saved.plan);text.value=checked.prompt;review();dialog.showModal();}}}catch{try{sessionStorage.removeItem(key);}catch{ /* Storage may be disabled; manual mode remains available. */ }}
