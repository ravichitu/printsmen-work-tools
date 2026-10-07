import {readFile,mkdir,writeFile,rename,unlink,lstat,open} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {updateConfig,verifyRelease,compareVersions,MAX_INSTALLER,sha256} from './release.mjs';

const IDLE_MS=5*60*1000;
export class UpdateManager {
  constructor({root,config,version,installed=false,cache,fetcher=fetch,launch,now=Date.now}){
    this.root=root;this.config=updateConfig(config);this.version=version;this.installed=installed;this.cache=cache;
    this.fetcher=fetcher;this.now=now;this.clients=new Map();this.lastActivity=now();this.lastChecked=null;
    this.phase=this.config.configured?'idle':'unconfigured';this.message=this.config.configured?'Automatic update checks enabled.':'Owner must configure an HTTPS release feed and signing public key. No update files will be downloaded.';
    this.launch=launch||((file)=>new Promise((resolve,reject)=>{
      if(process.platform!=='win32')return reject(new Error('Installer updates require Windows.'));
      const child=spawn(file,['/S','/UPDATE','/D='+this.root],{detached:true,stdio:'ignore',windowsHide:true,windowsVerbatimArguments:true});
      child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
      child.once('exit',code=>{if(code!==0){this.phase='error';this.message='Installer did not complete. Your existing installation was not replaced, or needs owner recovery. Check the installation directory before retrying.';}});
    }));
  }
  status(){return {version:this.version,configured:this.config.configured,installed:this.installed,phase:this.phase,message:this.message,
    lastChecked:this.lastChecked,release:this.release?{version:this.release.version,notes:this.release.notes,publishedAt:this.release.publishedAt,bytes:this.release.bytes}:null,
    automatic:true,idleMinutes:5,idle:this.isIdle(),openEditors:[...this.clients.values()].filter(c=>c.editor).length,canInstall:this.installed&&this.phase==='downloaded'};}
  openClient(route){
    const id=randomUUID();this.clients.set(id,{editor:route==='badge.html'||route==='products.html'||route.startsWith('printsmen/'),seen:0});
    this.lastActivity=this.now();return id;
  }
  heartbeat({id,closed=false,active=false}){
    const client=this.clients.get(id);if(!client)return false;
    if(closed){this.clients.delete(id);this.lastActivity=this.now();return true;}
    client.seen=this.now();if(active)this.lastActivity=this.now();return true;
  }
  isIdle(){
    if(this.now()-this.lastActivity<IDLE_MS)return false;
    // A missing heartbeat might be a suspended tab, not a closed design. Never expire it into permission to update.
    return [...this.clients.values()].every(c=>!c.editor&&c.seen&&this.now()-c.seen<45000);
  }
  async check(){
    if(!this.config.configured)return this.status();
    if(this.working||this.phase==='installing')return this.status();
    this.working=true;this.phase='checking';this.message='Checking the owner release feed...';
    try{
      // GitHub's stable release-asset URL redirects to the current release. The
      // envelope is still verified before it is trusted, so the redirect only
      // selects the bytes that are later checked with the pinned Ed25519 key.
      const response=await this.fetcher(this.config.feedUrl,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Update feed returned HTTP '+response.status+'.');
      let size=0;const chunks=[];
      for await(const chunk of response.body){size+=chunk.length;if(size>32768)throw new Error('Update feed is too large.');chunks.push(chunk);}
      const release=verifyRelease(JSON.parse(Buffer.concat(chunks).toString('utf8')),this.config);
      this.lastChecked=new Date(this.now()).toISOString();
      if(compareVersions(release.version,this.version)<=0){this.release=null;this.downloaded=null;this.phase='current';this.message='This installation is up to date.';}
      else {if(this.release?.sha256!==release.sha256)this.downloaded=null;this.release=release;this.phase=this.downloaded?'downloaded':'available';this.message=this.downloaded?'Verified update is waiting for an idle studio.':'A signed update is available.';}
    }catch(error){this.phase='error';this.message=error.message;}
    finally{this.working=false;}
    return this.status();
  }
  async download(){
    if(this.working||!this.release||!['available','downloaded','error'].includes(this.phase))return this.status();
    this.working=true;this.phase='downloading';this.message='Downloading and checking the signed installer...';
    const release=this.release;let temp;
    try{
      await mkdir(this.cache,{recursive:true});if((await lstat(this.cache)).isSymbolicLink())throw new Error('Update cache cannot be a link.');
      const file=path.join(this.cache,release.version+'-'+release.sha256.slice(0,16)+'.exe');temp=file+'.'+randomUUID()+'.part';
      const handle=await open(temp,'wx');let length=0;const hash=createHash('sha256');
      try{
        // GitHub release downloads redirect to their content-addressed CDN URL.
        // The signed URL, byte count and SHA-256 are verified before install.
        const response=await this.fetcher(release.url,{redirect:'follow',signal:AbortSignal.timeout(300000)});
        if(!response.ok)throw new Error('Installer download returned HTTP '+response.status+'.');
        for await(const chunk of response.body){length+=chunk.length;if(length>release.bytes||length>MAX_INSTALLER)throw new Error('Installer size does not match the signed release.');hash.update(chunk);await handle.writeFile(chunk);}
      }finally{await handle.close();}
      if(length!==release.bytes||hash.digest('hex')!==release.sha256)throw new Error('Installer checksum verification failed. Nothing was installed.');
      await rename(temp,file);temp=null;this.downloaded=file;this.phase='downloaded';this.message='Verified installer ready. Automatic installation waits until every editor is closed and the studio is idle for five minutes.';
    }catch(error){this.downloaded=null;this.phase='error';this.message=error.message;}
    finally{if(temp)await unlink(temp).catch(()=>{});this.working=false;}
    return this.status();
  }
  async install({manual=false}={}){
    if(this.working||this.phase!=='downloaded'||!this.downloaded||!this.installed)return this.status();
    if(!manual&&!this.isIdle())return this.status();
    this.working=true;
    try{
      if((await lstat(this.downloaded)).isSymbolicLink())throw new Error('Downloaded installer cannot be a link.');
      const bytes=await readFile(this.downloaded);
      if(bytes.length!==this.release.bytes||sha256(bytes)!==this.release.sha256)throw new Error('Downloaded installer changed. Download it again.');
      if(!manual&&!this.isIdle())return this.status();
      await this.launch(this.downloaded);this.phase='installing';this.message='Installer launched. The studio will restart after the update. Keep this computer on.';
    }catch(error){this.phase='error';this.message=error.message;}
    finally{this.working=false;}
    return this.status();
  }
  async tick(){
    if(!this.config.configured||this.working||this.phase==='installing')return;
    if(this.phase==='downloaded'){await this.install();return;}
    if(!this.nextCheck||this.now()>=this.nextCheck){
      this.nextCheck=this.now()+this.config.checkIntervalHours*3600000;
      await this.check();if(this.phase==='available'&&this.installed)await this.download();
    }
  }
  start(){this.initial=setTimeout(()=>this.tick().catch(()=>{}),3000);this.initial.unref();this.timer=setInterval(()=>this.tick().catch(()=>{}),30000);this.timer.unref();}
  close(){clearTimeout(this.initial);clearInterval(this.timer);}
}

export async function loadUpdateManager(root){
  const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
  let config={schema:1,channel:'preview',feedUrl:'',publicKey:'',checkIntervalHours:6};
  try{config=JSON.parse(await readFile(path.join(root,'updates-config.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  let installed=false;
  try{const marker=JSON.parse(await readFile(path.join(root,'.preview-installation.json'),'utf8'));installed=marker.product==='printsmen-badge-studio-preview'&&path.resolve(marker.root).toLowerCase()===path.resolve(root).toLowerCase();}catch{}
  const id=createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0,24);
  const cache=path.join(process.env.LOCALAPPDATA||root,'PrintsMen','UpdateCache',id);
  return new UpdateManager({root,config,version,installed,cache});
}
