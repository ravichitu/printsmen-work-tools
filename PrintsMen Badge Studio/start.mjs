import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.dirname(fileURLToPath(import.meta.url));
const expected=createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,24);
const port=Number(process.env.PORT||(existsSync(path.join(root,'preview-manifest.json'))?4188:4178));
const base='http://127.0.0.1:'+port;
async function ready(){
  try{const r=await fetch(base+'/api/studio/status',{signal:AbortSignal.timeout(1000)});if(!r.ok)return null;const data=await r.json();return data.product==='printsmen-badge-studio'&&data.rootId===expected?data:null;}catch{return null;}
}
if(!await ready()){
  let occupied=false;
  try{await fetch(base,{signal:AbortSignal.timeout(1000)});occupied=true;}catch{}
  if(occupied){console.error('Another or older studio is running on this port. Save your work and close that server before starting this installation.');process.exit(1);}
  const server=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...process.env,PORT:String(port)},detached:true,stdio:'ignore',windowsHide:true});
  server.on('error',e=>console.error(e.message));server.unref();
  for(let n=0;n<30&&!await ready();n++)await new Promise(r=>setTimeout(r,200));
}
const status=await ready();
if(!status){console.error('Could not start Customised Studio. Check the port and installation.');process.exitCode=1;}
else{
  const manager=process.argv.includes('--updates');
  const url=base+(status.authentication?.required?'/login.html'+(manager?'?next=updates':''):manager?'/updates.html':status.licence.active?'/index.html':'/activation.html');
  console.log('Customised Studio is ready: '+url);
  if(!process.argv.includes('--no-open')&&process.platform==='win32'){
    const browser=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process '${url}'`],{windowsHide:true,stdio:'ignore'});
    browser.on('error',()=>console.log('Open the address above in your browser.'));
  }
}
