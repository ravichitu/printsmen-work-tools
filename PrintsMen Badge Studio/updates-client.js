(() => {
  const script=document.currentScript,id=script?.dataset.client,version=script?.dataset.version,csrf=script?.dataset.csrf;
  if(!id)return;
  let active=true,closed=false;
  for(const name of ['pointerdown','keydown','input','wheel'])window.addEventListener(name,()=>{active=true;},{passive:true});
  async function beat(){
    if(closed)return;
    try{const response=await fetch('/api/updates/heartbeat',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-CSRF':csrf},body:JSON.stringify({id,active})});
      if(response.ok)active=false;
      if(!response.ok){const state=await(await fetch('/api/studio/status',{cache:'no-store'})).json();
        // Editor tabs block automatic installation. Never reload an editor following a manual update.
        if(state.version&&state.version!==version&&!/badge\.html|\/printsmen\//.test(location.pathname))location.reload();
      }
    }catch{}
  }
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    closed=true;navigator.sendBeacon('/api/updates/heartbeat',new Blob([JSON.stringify({id,closed:true,csrf})],{type:'application/json'}));
  });
  beat();setInterval(beat,10000);
})();
