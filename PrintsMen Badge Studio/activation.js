const $ = id => document.getElementById(id);
let token = '', busy = false;
async function refresh() {
  const response = await fetch('/api/studio/status', {cache:'no-store'});
  if (!response.ok) throw new Error('Could not read installation status.');
  const data = await response.json(), licence = data.licence;
  token = data.csrf;
  $('state').textContent = {active:'Activated',pending:'Approval required',invalid:'Installation locked',development:'Development copy',preview:'Local preview'}[licence.state] || 'Unknown';
  $('state').classList.toggle('active', licence.state === 'active');
  $('message').textContent = licence.message;
  $('customer').textContent = licence.customer || 'Not approved yet';
  $('installation').textContent = licence.installationId || 'Not registered';
  $('activated').textContent = licence.activatedAt ? new Date(licence.activatedAt).toLocaleString(undefined, {dateStyle:'full',timeStyle:'long'}) : 'Not activated';
  $('utc').textContent = licence.activatedAt || 'Not activated';
  $('validity').textContent = licence.state === 'active' ? (licence.expiresAt?'Expires '+new Date(licence.expiresAt).toLocaleString():'Lifetime of this installation; no expiry') : ['development','preview'].includes(licence.mode) ? 'No production licence applied' : 'Approval required';
  $('tools').textContent = licence.state === 'active' ? data.tools.filter(tool => licence.tools.includes(tool.id)).map(tool => tool.name).join(', ') : ['development','preview'].includes(licence.mode) ? 'All tools available for local testing' : 'Locked until approved';
  $('open').hidden = !licence.active;
  $('activate').disabled = busy || !data.onlineActivation || licence.state === 'invalid';
  if (licence.customer && !$('shop').value) $('shop').value = licence.customer;
  if (!data.onlineActivation) $('result').textContent = licence.mode==='managed'?'Use Offline activation below to exchange files with your owner.':'This preview is not a managed installation. Offline licensing requires an owner-issued managed package.';
}
$('activationForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true; $('activate').disabled = true; $('result').textContent = 'Contacting the online approval service...';
  try {
    const response = await fetch('/api/licence/activate', {method:'POST', headers:{'Content-Type':'application/json','X-Studio-CSRF':token}, body:JSON.stringify({customer:$('shop').value.trim(),licenceKey:$('licenceKey').value.trim(),client:{email:$('clientEmail').value.trim(),phone:$('clientPhone').value.trim()}})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Activation failed.');
    $('result').textContent = result.message;
  } catch (error) { $('result').textContent = error.message; }
  finally { busy = false; await refresh().catch(error => { $('message').textContent = error.message; }); }
});
function downloadActivation(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const offline=document.createElement('section');
const title=document.createElement('h2');title.textContent='Offline activation';offline.append(title);
const notice=document.createElement('label'),consent=document.createElement('input');consent.type='checkbox';notice.append(consent,document.createTextNode(' Include client details, installation ID, device hash and application version in the owner activation request. No artwork or documents are collected. Send this file privately to your owner; it contains your licence key.'));offline.append(notice);
async function offlineCall(action,body){const response=await fetch('/api/licence/offline/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-CSRF':token},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
function offlineAction(label,action){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=async()=>{if(busy)return;busy=true;button.disabled=true;try{await action();}catch(error){$('result').textContent=error.message;}finally{busy=false;button.disabled=false;}};offline.append(button);}
offlineAction('Download activation request',async()=>{const result=await offlineCall('request',{consent:consent.checked,customer:$('shop').value.trim(),licenceKey:$('licenceKey').value.trim(),client:{email:$('clientEmail').value.trim(),phone:$('clientPhone').value.trim()}});downloadActivation(result,'printsmen-activation-request.json');$('result').textContent='Send the request to your owner for approval.';});
const approval=document.createElement('input');approval.type='file';approval.accept='.json';approval.setAttribute('aria-label','Owner approval file');offline.append(approval);
offlineAction('Import owner approval',async()=>{const file=approval.files[0];if(!file||file.size>16384)throw new Error('Choose an owner approval JSON file under 16 KB.');const result=await offlineCall('import',JSON.parse(await file.text()));await refresh();$('result').textContent=result.message;});
offlineAction('Download activation confirmation',async()=>{downloadActivation(await offlineCall('confirmation',{}),'printsmen-activation-confirmation.json');$('result').textContent='Return this confirmation file to the owner to update the dashboard.';});
$('activationForm').after(offline);
refresh().catch(error => { $('message').textContent = error.message; $('state').textContent = 'Unavailable'; });
