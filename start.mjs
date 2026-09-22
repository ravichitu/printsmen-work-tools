import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const url='http://127.0.0.1:4178/index.html';
async function ready(){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(!r.ok)throw new Error('not ready');return (await r.text()).includes('<title>PrintsMen | Badge Studio</title>');}catch{return false;}
}
if(!await ready()){
  const server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{cwd:fileURLToPath(new URL('.',import.meta.url)),detached:true,stdio:'ignore',windowsHide:true});
  server.on('error',e=>console.error(e.message));server.unref();
  for(let n=0;n<30&&!await ready();n++)await new Promise(r=>setTimeout(r,200));
}
if(!await ready()){console.error('Could not start Badge Studio. Port 4178 may be occupied.');process.exitCode=1;}
else{
  console.log('Badge Studio is ready: '+url);
  if(!process.argv.includes('--no-open')&&process.platform==='win32'){
    const browser=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process '${url}'`],{windowsHide:true,stdio:'ignore'});
    browser.on('error',()=>console.log('Open the address above in your browser.'));
  }
}
