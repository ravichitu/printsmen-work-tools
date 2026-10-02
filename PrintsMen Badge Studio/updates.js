const $=id=>document.getElementById(id);
let csrf='',busy=false;
function render(state){
  $('phase').textContent=state.phase;$('version').textContent='Installed version '+state.version;
  $('message').textContent=state.message;$('checked').textContent=state.lastChecked?'Last checked: '+new Date(state.lastChecked).toLocaleString():'No successful release check yet.';
  $('idleStatus').textContent=state.installed?`${state.openEditors} editor tab(s) tracked. ${state.idle?'Idle window reached.':'Waiting for closed editors and the idle window.'}`:'Development copy: automatic installation is disabled. Use the packaged application.';
  $('release').hidden=!state.release;if(state.release){$('releaseTitle').textContent='Available: '+state.release.version;$('notes').textContent=state.release.notes;$('size').textContent=(state.release.bytes/1048576).toFixed(1)+' MB';}
  $('check').disabled=!state.configured||busy||['checking','downloading','installing'].includes(state.phase);
  $('download').hidden=!state.release||!['available','error'].includes(state.phase);$('download').disabled=busy;
  $('install').hidden=!state.canInstall;$('install').disabled=busy;
}
async function request(action){
  const response=await fetch('/api/updates/'+action,action==='status'?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-Studio-CSRF':csrf},body:JSON.stringify({savedWork:action==='install'})});
  if(response.status===401){location.replace('/login.html?next=updates');return;}
  const state=await response.json();if(!response.ok)throw new Error(state.error||'Update request failed.');render(state);
}
async function act(action){if(busy)return;busy=true;try{await request(action);}catch(error){$('message').textContent=error.message;}finally{busy=false;}}
$('check').onclick=()=>act('check');$('download').onclick=()=>act('download');
$('install').onclick=()=>{$('savedWork').checked=false;$('confirm').disabled=true;$('confirmInstall').showModal();};
$('savedWork').onchange=()=>{$('confirm').disabled=!$('savedWork').checked;};
$('cancel').onclick=()=>$('confirmInstall').close();
$('confirm').onclick=()=>{if(!$('savedWork').checked)return;$('confirmInstall').close();act('install');};
fetch('/api/studio/status',{cache:'no-store'}).then(r=>r.json()).then(state=>{csrf=state.csrf;return request('status');}).catch(error=>$('message').textContent=error.message);
setInterval(()=>{if(!busy)request('status').catch(()=>{$('message').textContent='Studio is restarting or unavailable. Reopen Update Manager after installation finishes.';});},10000);
