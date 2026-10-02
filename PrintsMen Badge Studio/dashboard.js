const field=id=>document.getElementById(id);
const displayDate=value=>value?new Date(value).toLocaleString():'Not approved';
async function readJson(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error(`Local status unavailable (${response.status}).`);
  return response.json();
}
async function loadDashboard(){
  try{
    const studio=await readJson('/api/studio/status'),licence=studio.licence||{},auth=studio.authentication||{};
    field('licenceState').textContent={active:'Activated',pending:'Approval required',invalid:'Installation locked',preview:'Local preview',development:'Development copy'}[licence.state]||'Unknown';
    field('client').textContent=licence.customer||'Not registered';
    field('installation').textContent=licence.installationId||'Not registered';
    field('approved').textContent=displayDate(licence.activatedAt);
    field('access').textContent=licence.mode==='preview'?'All tools for local testing; no production licence':licence.mode==='development'?'Unlocked development source':licence.active?studio.tools.filter(tool=>licence.tools?.includes(tool.id)).map(tool=>tool.name).join(', ')||'No tools assigned':'Locked until owner approval';
    field('sessionState').textContent=auth.required?(auth.loggedIn?'Signed in':'Sign-in required'):'Local development';
    field('sessionDetails').textContent=auth.required?'Operator login is separate from the installation licence.':'No operator sign-in is required in this development copy.';
    field('version').textContent=studio.version||'Development source';
    field('dashboardMessage').textContent=licence.message||'Status loaded from this installation.';
    try{
      const updates=await readJson('/api/updates/status');
      field('updateState').textContent=updates.message||updates.phase||'Unknown';
      field('version').textContent=updates.version||studio.version||'Unknown';
      field('feed').textContent=updates.configured?'Owner-signed HTTPS feed configured':'Not configured';
      field('release').textContent=updates.release?.version||'None';
      field('automatic').textContent=updates.installed?'When editors are closed and the app is idle':'Unavailable in this source copy';
    }catch(error){
      field('updateState').textContent='Unavailable';
      field('feed').textContent='Check Update Manager';
      field('release').textContent='Unknown';
      field('automatic').textContent='Not confirmed';
    }
  }catch(error){field('dashboardMessage').textContent=error.message;field('licenceState').textContent='Unavailable';field('sessionState').textContent='Unavailable';field('updateState').textContent='Unavailable';}
}
loadDashboard();
