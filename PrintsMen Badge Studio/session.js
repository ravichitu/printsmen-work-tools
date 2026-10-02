(async()=>{
  const response=await fetch('/api/studio/status',{cache:'no-store'});if(!response.ok)return;
  const state=await response.json();if(!state.authentication?.required)return;
  if(!state.authentication.loggedIn){location.replace('/login.html');return;}
  const header=document.querySelector('header');if(!header)return;
  const button=document.createElement('button');button.type='button';button.textContent='Sign out ('+state.authentication.username+')';button.style.cssText='padding:10px 14px;background:#edcd77;color:#29143f;border:0;border-radius:6px;font:700 15px system-ui;cursor:pointer';
  button.onclick=async()=>{if(!confirm('Save/export your work before signing out. Sign out now?'))return;const logout=await fetch('/api/session/logout',{method:'POST',headers:{'X-Studio-CSRF':state.csrf}});if(logout.ok)location.replace('/login.html');};
  header.append(button);
})().catch(()=>{});
