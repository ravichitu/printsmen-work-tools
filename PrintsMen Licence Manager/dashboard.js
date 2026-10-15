import {licenceSheet} from './licence-sheet.mjs';
const $ = id => document.getElementById(id);
let csrf = '', tools = [], busy = false, signedIn = false;
let issuedRecord=null;
let supabase=null,supabaseToken='',supabaseUser=null;
function clearSecurityInputs(){for(const id of ['securityPassword','securityCode','newOwnerPassword','mfaSecret','mfaConfirmCode'])$(id).value='';$('mfaConfirmForm').hidden=true;}
function signedOut(){signedIn=false;csrf='';supabase=null;supabaseToken='';supabaseUser=null;clearKey();clearSecurityInputs();$('dashboard').hidden=true;$('loginPanel').hidden=false;$('logout').hidden=true;$('requests').replaceChildren();$('keys').replaceChildren();$('auditRows').replaceChildren();}
function clearRecoveryCodes(){$('securityReceipt').hidden=true;$('ownerRecoveryCodes').textContent='';}
const clientFields=[['contactPerson','Contact person',120],['phone','Phone',40],['email','Email',254],['address','Address',600],['reference','Customer reference',80]];
const clientForm=document.createElement('div');clientForm.className='client-fields';
for(const [name,label,max] of clientFields){const wrap=document.createElement('label');wrap.textContent=label;const field=document.createElement(name==='address'?'textarea':'input');field.id='client-'+name;field.maxLength=max;if(name==='email')field.type='email';if(name==='phone')field.type='tel';wrap.append(field);clientForm.append(wrap);}
$('customer').after(clientForm);
const expiryLabel=document.createElement('label');expiryLabel.textContent='Expiry date (optional, valid through this UTC date)';const expiry=document.createElement('input');expiry.type='date';expiry.id='client-expiry';expiryLabel.append(expiry);clientForm.append(expiryLabel);
const termNote=$('keyForm').querySelector('p');termNote.textContent='One key, one installation. Blank expiry means installation lifetime. Reinstall requires a replacement key and new owner approval. Expiry uses the client clock offline; this is not clock-tamper-proof enforcement.';
const sheet=document.createElement('section');sheet.id='licenceSheet';sheet.hidden=true;document.body.append(sheet);
const sheetControls=document.createElement('div');sheetControls.className='sheet-controls';
const printButton=document.createElement('button');printButton.textContent='Print / Save PDF';printButton.onclick=()=>window.print();
const closeSheet=document.createElement('button');closeSheet.textContent='Close licence sheet';closeSheet.onclick=()=>{sheet.hidden=true;sheet.replaceChildren();};sheetControls.append(printButton,closeSheet);
function showSheet(record,request){sheet.replaceChildren(sheetControls);const content=document.createElement('article');content.innerHTML=licenceSheet(record,tools,request);sheet.append(content);sheet.hidden=false;sheet.scrollIntoView({block:'start'});}
const printNew=document.createElement('button');printNew.type='button';printNew.textContent='Open client licence sheet';printNew.onclick=()=>{if(issuedRecord)showSheet(issuedRecord,null);};$('newKeyPanel').append(printNew);
const recoveryView=document.createElement('input');recoveryView.readOnly=true;recoveryView.id='newRecoveryKey';recoveryView.setAttribute('aria-label','Owner-only recovery key');const recoveryNote=document.createElement('p');recoveryNote.textContent='OWNER ONLY: recovery key is shown once. Keep it separate from the client sheet. The server stores only its hash.';$('newKeyPanel').append(recoveryNote,recoveryView);
const ownerPrint=document.createElement('button');ownerPrint.type='button';ownerPrint.textContent='Open owner recovery sheet';ownerPrint.onclick=()=>{if(!issuedRecord)return;showSheet(issuedRecord,null);const title=document.createElement('h2');title.textContent='OWNER ONLY - RECOVERY SECRET';const secret=document.createElement('p');secret.textContent=issuedRecord.recoveryKey;sheet.querySelector('article').append(title,secret);};$('newKeyPanel').append(ownerPrint);
const recoveryPanel=document.createElement('section');recoveryPanel.className='panel';const recoveryTitle=document.createElement('h2');recoveryTitle.textContent='Owner-controlled reinstall recovery';const recoveryForm=document.createElement('form');
for(const [id,label,max] of [['recoveryRecord','Original key record ID',36],['recoverySecret','Owner recovery key',37]]){const wrap=document.createElement('label');wrap.textContent=label;const field=document.createElement('input');field.id=id;field.maxLength=max;field.required=true;field.autocomplete='off';if(id==='recoverySecret')field.type='password';wrap.append(field);recoveryForm.append(wrap);}
const recoverButton=document.createElement('button');recoverButton.textContent='Issue replacement key';recoveryForm.append(recoverButton);recoveryPanel.append(recoveryTitle,recoveryForm);$('dashboard').append(recoveryPanel);
recoveryForm.onsubmit=event=>{event.preventDefault();run(async()=>{if(!confirm('Consume this one-use recovery key and issue a replacement for the same client and tools? The old key cannot activate again. Existing offline copies are not instantly disabled.'))return;const result=await api('/api/recover',{keyId:$('recoveryRecord').value.trim(),recoveryKey:$('recoverySecret').value.trim()});clearKey();issuedRecord=result;$('newKey').value=result.key;recoveryView.value=result.recoveryKey;$('newKeyPanel').hidden=false;$('recoverySecret').value='';await refresh();$('newKeyPanel').scrollIntoView();});};
function clearKey(){issuedRecord=null;$('newKey').value='';if($('newRecoveryKey'))$('newRecoveryKey').value='';$('newKeyPanel').hidden=true;sheet.hidden=true;sheet.replaceChildren();}
async function api(url, body) {
  const response = await fetch(url, body === undefined ? {cache:'no-store'} : {method:'POST',headers:{'Content-Type':'application/json','X-Owner-CSRF':csrf},body:JSON.stringify(body)});
  const value = await response.json();
  if (response.status === 401) { signedOut(); clearRecoveryCodes(); }
  if (!response.ok) throw new Error(value.error || 'Request failed.');
  return value;
}
function cell(row, text) { const td=document.createElement('td'); td.textContent=text; row.append(td); return td; }
function timestamp(row, value) { const td=cell(row,''); if(!value){td.textContent='-';return;} const time=document.createElement('time');time.dateTime=value;time.textContent=new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'long'});time.title=value+' (authority UTC)';td.append(time);const utc=document.createElement('small');utc.textContent=value;td.append(utc); }
const names = ids => ids.map(id=>tools.find(tool=>tool.id===id)?.name || id).join(', ');
async function refresh() {
  const data = await api('/api/dashboard');
  signedIn=true; csrf=data.csrf; tools=data.tools;
  const security=data.security;
  $('securityStatus').textContent=security.mfaEnabled?'Authenticator enabled. Unused owner recovery codes: '+security.recoveryCodesRemaining+'.':'Authenticator is not enabled. Public activation is blocked until setup is confirmed.';
  $('auditNote').textContent='Latest '+security.audit.length+' events shown. The local log retains at most 500 events; older events removed: '+security.auditDropped+'. This is not a tamper-proof external audit log.';
  $('auditRows').replaceChildren();for(const event of security.audit){const row=document.createElement('tr');timestamp(row,event.at);cell(row,event.event);cell(row,event.actor);cell(row,event.target||'-');$('auditRows').append(row);}
  $('loginPanel').hidden=true; $('dashboard').hidden=false; $('logout').hidden=false;
  if (!$('toolChoices').querySelector('input')) for (const tool of tools) {
    const label=document.createElement('label'), input=document.createElement('input');input.type='checkbox';input.value=tool.id;input.checked=true;label.append(input,document.createTextNode(tool.name));$('toolChoices').append(label);
  }
  $('keyCount').textContent=data.keys.length; $('pendingCount').textContent=data.summary.pending; $('activeCount').textContent=data.summary.confirmed;
  $('installationSummary').textContent=`${data.summary.clients} client names | ${data.summary.installations} registered installations | ${data.summary.approved} approved | ${data.summary.expired} expired. Unreported copies and live offline usage cannot be counted.`;
  $('requests').replaceChildren();
  for (const request of [...data.requests].reverse()) {
    const row=document.createElement('tr');const who=cell(row,request.customer);const id=document.createElement('small');id.textContent=request.installationId;who.append(id);
    cell(row,names(request.tools));cell(row,request.status);timestamp(row,request.receivedAt);timestamp(row,request.approvedAt);timestamp(row,request.confirmedAt);
    const actions=cell(row,'');
    const mode=document.createElement('small');mode.textContent=(request.activationMode||'online')+' activation; '+(request.registration?.appVersion||'version not reported')+'; device-reported apply time: '+(request.clientActivatedAt||'not received')+'; owner confirmation: '+(request.confirmedAt||'not confirmed');who.append(mode);
    if(request.state==='approved'){const button=document.createElement('button');button.textContent='Download approval';button.onclick=()=>run(async()=>saveOffline(await api('/api/offline/receipt',{installationId:request.installationId}),'printsmen-approval-'+request.installationId+'.json'));actions.append(button);}
    if(request.state==='pending') for(const decision of ['approve','reject']) {const button=document.createElement('button');button.textContent=decision==='approve'?'Approve':'Reject';button.onclick=()=>run(async()=>{if(!confirm((decision==='approve'?'Approve and permanently bind this key to':'Reject')+' installation '+request.installationId+'?'))return;await api('/api/decision',{installationId:request.installationId,decision});await refresh();});actions.append(button);}
    $('requests').append(row);
  }
  if(!data.requests.length){const row=document.createElement('tr');const td=cell(row,'No activation requests yet.');td.colSpan=7;$('requests').append(row);}
  $('keys').replaceChildren();
  for (const key of [...data.keys].reverse()){const row=document.createElement('tr');const td=cell(row,key.customer);const id=document.createElement('small');id.textContent=key.id;td.append(id);cell(row,names(key.tools));timestamp(row,key.createdAt);const binding=cell(row,key.boundInstallation||'Unused; awaits an approved installation');const button=document.createElement('button');button.textContent='Client details / print';button.onclick=()=>showSheet(issuedRecord?.id===key.id?{...key,key:issuedRecord.key}:key,data.requests.find(r=>r.installationId===key.boundInstallation)||data.requests.find(r=>r.keyId===key.id));binding.append(button);$('keys').append(row);}
}
async function run(action){if(busy)return;busy=true;$('message').textContent='Working...';try{await action();$('message').textContent='Dashboard is up to date.';}catch(error){$('message').textContent=error.message;}finally{busy=false;}}
$('loginForm').onsubmit=event=>{event.preventDefault();run(async()=>{try{await api('/api/login',{password:$('password').value,code:$('loginCode').value.trim()});clearRecoveryCodes();await refresh();}finally{$('password').value='';$('loginCode').value='';}});};
$('securityForm').onsubmit=event=>{event.preventDefault();run(async()=>{try{const result=await api('/api/security/enrol/start',{password:$('securityPassword').value,code:$('securityCode').value.trim()});$('mfaSecret').value=result.secret;$('mfaConfirmForm').hidden=false;}finally{$('securityPassword').value='';$('securityCode').value='';}});};
$('mfaConfirmForm').onsubmit=event=>{event.preventDefault();run(async()=>{const result=await api('/api/security/enrol/confirm',{code:$('mfaConfirmCode').value.trim()});signedOut();$('ownerRecoveryCodes').textContent=result.recoveryCodes.join('\n');$('securityReceipt').hidden=false;$('securityReceipt').scrollIntoView({block:'start'});});};
$('cancelMfa').onclick=()=>run(async()=>{await api('/api/security/enrol/cancel',{});clearSecurityInputs();});
$('changeOwnerPassword').onclick=()=>run(async()=>{if(!$('newOwnerPassword').value||!confirm('Change the owner password and sign out every owner dashboard session?'))return;try{await api('/api/security/password',{password:$('securityPassword').value,code:$('securityCode').value.trim(),newPassword:$('newOwnerPassword').value});signedOut();clearRecoveryCodes();}finally{$('securityPassword').value='';$('securityCode').value='';$('newOwnerPassword').value='';}});
$('closeOwnerCodes').onclick=clearRecoveryCodes;
$('downloadOwnerCodes').onclick=()=>{const codes=$('ownerRecoveryCodes').textContent;if(!codes)return;const url=URL.createObjectURL(new Blob(['PRINTSMEN OWNER SIGN-IN RECOVERY\nKeep private. Each code is one-use and still requires the owner password.\nThese are NOT client licence recovery keys.\n\n'+codes+'\n'],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='printsmen-owner-recovery-codes.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('keyForm').onsubmit=event=>{event.preventDefault();run(async()=>{const chosen=Array.from($('toolChoices').querySelectorAll('input:checked')).map(input=>input.value);if(!chosen.length)throw new Error('Select at least one tool.');const client=Object.fromEntries(clientFields.map(([name])=>[name,$('client-'+name).value.trim()]));const expiresAt=expiry.value?new Date(expiry.value+'T23:59:59.999Z').toISOString():null;const result=await api('/api/keys',{customer:$('customer').value.trim(),tools:chosen,client,expiresAt});clearKey();issuedRecord=result;$('newKey').value=result.key;recoveryView.value=result.recoveryKey;$('newKeyPanel').hidden=false;await refresh();});};
$('all').onclick=()=>document.querySelectorAll('#toolChoices input').forEach(input=>input.checked=true);
$('none').onclick=()=>document.querySelectorAll('#toolChoices input').forEach(input=>input.checked=false);
$('copyKey').onclick=()=>run(async()=>{try{await navigator.clipboard.writeText($('newKey').value);}catch{$('newKey').select();throw new Error('Clipboard unavailable. The key is selected for copying.');}});
$('refresh').onclick=()=>run(refresh);
$('logout').onclick=()=>run(async()=>{await api('/api/logout',{});signedOut();clearRecoveryCodes();});
setInterval(()=>{if(signedIn&&!busy)refresh().catch(error=>$('message').textContent=error.message);},30000);
function saveOffline(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const offlinePanel=document.createElement('section');offlinePanel.className='panel';const offlineTitle=document.createElement('h2');offlineTitle.textContent='Offline clients and installation register';const summary=document.createElement('p');summary.id='installationSummary';offlinePanel.append(offlineTitle,summary);
for(const [action,label] of [['request','Import client activation request'],['confirmation','Import client confirmation']]){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=()=>run(async()=>{try{const file=input.files[0];if(!file||file.size>16384)throw new Error('Choose an activation JSON file under 16 KB.');await api('/api/offline/'+action,JSON.parse(await file.text()));await refresh();}finally{input.value='';}});wrap.append(input);offlinePanel.append(wrap);}
$('dashboard').prepend(offlinePanel);
async function cloudRequest(path,method='GET',body){
  const response=await fetch(supabase.url+path,{method,headers:{apikey:supabase.publishableKey,Authorization:'Bearer '+supabaseToken,...(body?{'Content-Type':'application/json'}:{}),...(method==='POST'?{Prefer:'resolution=merge-duplicates,return=minimal'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(15000),redirect:'error'});
  const text=await response.text();if(!response.ok){let detail='';try{detail=JSON.parse(text).message||JSON.parse(text).error_description||'';}catch{}throw new Error(detail||'Supabase request failed with HTTP '+response.status+'.');}return text?JSON.parse(text):null;
}
function cloudState(message,connected=false){$('cloudStatus').textContent=message;$('cloudSync').disabled=!connected;$('cloudDisconnect').hidden=!connected;$('cloudLogin').hidden=connected;}
$('cloudLogin').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
  $('cloudStatus').textContent='Checking Supabase account and access...';
  const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;$('cloudPassword').value='';
  try{
    const config=await api('/api/supabase/config');supabase=config;
    const response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email,password}),cache:'no-store',signal:AbortSignal.timeout(12000),redirect:'error'});const auth=await response.json();if(!response.ok||!auth.access_token)throw new Error('Supabase sign-in failed. Check the email and password.');
    supabaseToken=auth.access_token;supabaseUser=auth.user?.id;
    const profiles=await cloudRequest('/rest/v1/profiles?id=eq.'+encodeURIComponent(supabaseUser)+'&select=role,account_state');
    if(!profiles?.length||profiles[0].account_state!=='active'||!['owner','admin'].includes(profiles[0].role))throw new Error('An active owner/admin profile is required to sync the licence register.');
    cloudState('Connected as '+email+'. No data has been synced yet.',true);
  }catch(error){supabaseToken='';supabaseUser=null;supabase=null;throw error;}
});});
$('cloudSync').addEventListener('click',()=>run(async()=>{
  if(!supabaseToken||!supabaseUser)throw new Error('Connect to Supabase first.');
  cloudState('Preparing local licence records and consented device reports...',true);
  try{
    const {keys,installations}=await api('/api/supabase/export');
    const batches=items=>{const result=[];for(let index=0;index<items.length;index+=100)result.push(items.slice(index,index+100));return result;};
    const clients=keys.map(key=>{const client=key.client||{};return{id:key.id,company_name:key.customer,contact_name:client.contactPerson||'',email:client.email||'',phone:client.phone||'',address:client.address||'',reference:client.reference||'',created_by:supabaseUser};});
    const licences=keys.map(key=>({id:key.id,client_id:key.id,key_hash:key.keyHash,allowed_tools:key.tools,installation_limit:1,licence_state:key.state,issued_at:key.createdAt,expires_at:key.expiresAt,created_by:supabaseUser}));
    const deviceRows=installations.map(item=>({user_id:supabaseUser,licence_id:item.keyId,install_id:item.installationId,device_hash:item.deviceHash,app_version:item.appVersion,platform:item.platform,activation_mode:item.activationMode,install_state:item.state,notice_accepted_at:item.noticeAcceptedAt,first_seen_at:item.receivedAt,approved_at:item.approvedAt,last_reported_at:item.lastReportedAt,client_activated_at:item.clientActivatedAt}));
    for(const batch of batches(clients))await cloudRequest('/rest/v1/clients?on_conflict=id','POST',batch);
    for(const batch of batches(licences))await cloudRequest('/rest/v1/licences?on_conflict=id','POST',batch);
    for(const batch of batches(deviceRows))await cloudRequest('/rest/v1/installations?on_conflict=install_id','POST',batch);
    cloudState('Sync complete at '+new Date().toLocaleString()+'. '+keys.length+' licence records and '+installations.length+' consented installation records sent.',true);
  }catch(error){cloudState('Sync incomplete: '+error.message,true);throw error;}
}));
$('cloudDisconnect').addEventListener('click',()=>{supabaseToken='';supabaseUser=null;supabase=null;cloudState('Disconnected. Supabase token cleared from this page.');});
refresh().catch(error=>{$('message').textContent=error.message==='Owner sign-in is required.'?'Sign in to manage licences.':error.message;});
