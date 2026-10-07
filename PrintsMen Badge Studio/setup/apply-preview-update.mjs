import {readFile,writeFile,mkdir,copyFile,lstat,realpath,rename,unlink,readdir,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {sha256,compareVersions,UPDATE_PRODUCT} from '../updates/release.mjs';
import {stopInstalledServer} from './managed-install.mjs';

const preserved=new Set(['operator-auth.json','updates-config.json','activation-authority.json']);
function relativeName(name){
  if(typeof name!=='string'||/[\x00-\x1f<>:"|?*\\]/.test(name)||name.split('/').some(p=>!p||p.startsWith('.')||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw new Error('Unsafe update path.');
  return name;
}
async function safeFile(root,name){
  relativeName(name);let full=root;
  for(const part of name.split('/')){full=path.join(full,part);const stat=await lstat(full).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});if(stat?.isSymbolicLink())throw new Error('Linked paths cannot be updated.');}
  return full;
}
async function manifest(root){
  const data=JSON.parse(await readFile(path.join(root,'preview-manifest.json'),'utf8'));
  if(data.schema!==1||data.product!==UPDATE_PRODUCT||!Array.isArray(data.files)||!data.files.length||data.files.length>5000)throw new Error('Invalid preview update manifest.');
  const names=new Set();
  for(const file of data.files){relativeName(file.path);const name=file.path.toLowerCase();if(names.has(name)||!/^[a-f0-9]{64}$/.test(file.hash))throw new Error('Invalid or duplicate update file.');names.add(name);}
  return data;
}
async function removeOwnedTree(root){
  for(const file of await readdir(root,{withFileTypes:true})){
    const full=path.join(root,file.name);
    if(file.isSymbolicLink())throw new Error('Unexpected link in update backup.');
    if(file.isDirectory())await removeOwnedTree(full);else await unlink(full);
  }
  await rmdir(root);
}
export async function applyPreviewUpdate({source,target,beforeWrite=()=>{},allowSameVersion=false}){
  if((await lstat(target)).isSymbolicLink())throw new Error('Cannot update a linked installation.');
  source=await realpath(source);target=await realpath(target);
  if(source===target||source.startsWith(target+path.sep)||target.startsWith(source+path.sep))throw new Error('Update staging and installation must be separate.');
  const marker=JSON.parse(await readFile(path.join(target,'.preview-installation.json'),'utf8'));
  if(marker.product!==UPDATE_PRODUCT||typeof marker.installationId!=='string'||path.resolve(marker.root).toLowerCase()!==target.toLowerCase())throw new Error('The preview installation identity does not match this directory.');
  const old=await manifest(target),next=await manifest(source);
  const versionOrder=compareVersions(next.version,old.version);
  if(versionOrder<0||(!allowSameVersion&&versionOrder===0))throw new Error(versionOrder<0?'The installer is older than the installed version.':'The same version is already installed.');
  const oldFiles=new Map(old.files.map(f=>[f.path.toLowerCase(),f]));
  for(const file of next.files){
    if(sha256(await readFile(await safeFile(source,file.path)))!==file.hash)throw new Error('Update payload failed verification: '+file.path);
    const destination=await safeFile(target,file.path),exists=await lstat(destination).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
    if(exists&&!oldFiles.has(file.path.toLowerCase()))throw new Error('Update would overwrite an unrecognised file: '+file.path);
  }
  for(const file of old.files){
    const full=await safeFile(target,file.path);
    if(!preserved.has(file.path)&&sha256(await readFile(full))!==file.hash)throw new Error('Installed file was modified; back it up before updating: '+file.path);
  }
  const backup=path.join(target,'.update-pending');
  await mkdir(backup).catch(error=>{if(error.code==='EEXIST')throw new Error('An interrupted update backup exists. Contact the owner before retrying.');throw error;});
  const names=[...new Set([...old.files.map(f=>f.path),...next.files.map(f=>f.path),'preview-manifest.json'])];
  const changes=[],createdDirectories=new Set();
  try{
    for(const name of names){
      const full=await safeFile(target,name),exists=await lstat(full).then(()=>true,e=>{if(e.code!=='ENOENT')throw e;return false;});
      if(exists){const copy=path.join(backup,name);await mkdir(path.dirname(copy),{recursive:true});await copyFile(full,copy);}
    }
    await writeFile(path.join(backup,'recovery.json'),JSON.stringify({schema:1,target,from:old.version,to:next.version,installationId:marker.installationId,ownedPaths:names},null,2));
    await stopInstalledServer(target,Number(process.env.PORT||4188));
    async function replace(name,bytes){
      const full=await safeFile(target,name);let dir=path.dirname(full);
      while(dir!==target){if(!await lstat(dir).then(()=>true,()=>false))createdDirectories.add(dir);dir=path.dirname(dir);}
      await mkdir(path.dirname(full),{recursive:true});await beforeWrite(name);
      const temp=full+'.update-'+randomUUID();
      try{await writeFile(temp,bytes,{flag:'wx'});changes.push(name);await rename(temp,full);}
      finally{await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    }
    for(const file of next.files){
      if(preserved.has(file.path)&&oldFiles.has(file.path.toLowerCase())){file.hash=sha256(await readFile(path.join(target,file.path)));continue;}
      await replace(file.path,await readFile(path.join(source,file.path)));
    }
    const nextNames=new Set(next.files.map(f=>f.path.toLowerCase()));
    for(const file of old.files)if(!nextNames.has(file.path.toLowerCase())){
      if(preserved.has(file.path)){next.files.push(file);continue;}
      changes.push(file.path);await unlink(path.join(target,file.path));
    }
    await replace('preview-manifest.json',JSON.stringify(next,null,2));
    for(const file of next.files)if(sha256(await readFile(path.join(target,file.path)))!==file.hash)throw new Error('Updated file verification failed: '+file.path);
  }catch(error){
    let rollbackError;
    for(const name of [...new Set(changes)].reverse()){
      try{const original=path.join(backup,name);if(await lstat(original).then(()=>true,()=>false))await copyFile(original,path.join(target,name));else await unlink(path.join(target,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});}catch(e){rollbackError=e;}
    }
    for(const dir of [...createdDirectories].sort((a,b)=>b.length-a.length))await rmdir(dir).catch(()=>{});
    if(rollbackError)throw new Error('Update failed and needs owner recovery. The .update-pending backup was kept. '+rollbackError.message);
    await removeOwnedTree(backup);throw error;
  }
  await removeOwnedTree(backup);
  return {version:next.version,installationId:marker.installationId};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const source=fileURLToPath(new URL('../',import.meta.url)),target=process.argv[2];
  if(!target)throw new Error('Provide the registered preview installation directory.');
  const result=await applyPreviewUpdate({source,target,allowSameVersion:process.argv.includes('--repair')});console.log(JSON.stringify(result));
  // The installer invokes this from its temporary runtime, so the installed runtime can be replaced.
  if(process.argv.includes('--restart')){
    const child=spawn(path.join(target,'runtime','node.exe'),[path.join(target,'start.mjs'),'--no-open'],{cwd:target,detached:true,stdio:'ignore',windowsHide:true});child.unref();
  }
}
