import {mkdir, readFile, writeFile, copyFile, lstat, readdir, unlink, rmdir, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline/promises';
import {LicenceStore} from '../licensing/store.mjs';
import {registerInstallation, InstallationGate, MARKER} from '../licensing/installation.mjs';
import {windowsProtection, windowsMachineHash, defaultStateFile} from '../licensing/windows.mjs';
import {validateAuthority} from '../licensing/online.mjs';
import {PRODUCT} from '../licensing/licence.mjs';
import {rootId} from '../studio-server.mjs';

const run = promisify(execFile);
const registry = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrintsMenBadgeStudio';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function validateManagedTarget(target, base) {
  const resolved = path.resolve(target), parent = path.resolve(base);
  if (resolved !== path.join(parent,'PrintsMen Badge Studio')) throw new Error('Setup can only modify the dedicated PrintsMen Badge Studio directory.');
  return resolved;
}
function validRelative(name) {
  return typeof name === 'string' && !!name && !name.includes('\\') && !name.includes(':') &&
    name.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));
}
async function manifest(root) {
  const value = JSON.parse(await readFile(path.join(root,'managed-manifest.json'),'utf8'));
  if (value.product !== PRODUCT || value.schema !== 1 || !Array.isArray(value.files) || !value.files.length || value.files.length > 5000 ||
      value.files.some(file=>!validRelative(file.path) || !/^[0-9a-f]{64}$/.test(file.hash)) || new Set(value.files.map(f=>f.path)).size !== value.files.length) throw new Error('Invalid managed installation manifest.');
  return value;
}
async function safeFile(root, relative) {
  if (!validRelative(relative)) throw new Error('Unsafe installation path.');
  const actualRoot = await realpath(root);
  let current = actualRoot;
  for (const part of relative.split('/')) {
    current = path.join(current,part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('Linked files/directories are not allowed in a managed installation.');
  }
  return current;
}

export async function stopInstalledServer(target, port=Number(process.env.PORT||4178)) {
  const origin='http://127.0.0.1:'+port;
  let status;
  try {
    const response=await fetch(origin+'/api/studio/status',{signal:AbortSignal.timeout(2000)});
    if(!response.ok)return;
    status=await response.json();
  } catch{return;}
  if(status.product!==PRODUCT||status.rootId!==rootId(target))return;
  const response=await fetch(origin+'/api/studio/shutdown',{method:'POST',headers:{Origin:origin,'X-Studio-CSRF':status.csrf},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('The installed server could not stop. Finish activation and close it before uninstalling.');
}

export async function installManaged({source, target, base, store, machineHash, allowTestHttp = false}) {
  target = validateManagedTarget(target,base);
  const list = await manifest(source);
  const config = validateAuthority(JSON.parse(await readFile(path.join(source,'activation-authority.json'),'utf8')), {allowTestHttp});
  // Check every input before creating an installation identity or touching the target.
  for (const file of list.files) if (digest(await readFile(await safeFile(source,file.path))) !== file.hash) throw new Error('Installer integrity check failed: '+file.path);
  const existing = await lstat(target).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  if (existing) throw new Error('The target already exists. Nothing was overwritten. Use managed uninstall before a fresh installation.');
  await mkdir(base,{recursive:true});
  if ((await lstat(base)).isSymbolicLink()) throw new Error('The installation base cannot be a link.');
  await mkdir(target);
  for (const file of list.files) {
    const destination = path.join(target,file.path);
    await mkdir(path.dirname(destination),{recursive:true});
    await copyFile(path.join(source,file.path),destination);
  }
  await copyFile(path.join(source,'managed-manifest.json'),path.join(target,'managed-manifest.json'));
  return registerInstallation({root:target,store,machineHash,publicKey:config.publicKey});
}

export async function uninstallManaged({target, base, store, machineHash, allowTestHttp = false}) {
  target = validateManagedTarget(target,base);
  if ((await lstat(target)).isSymbolicLink()) throw new Error('Refusing to uninstall a linked directory.');
  const config = validateAuthority(JSON.parse(await readFile(path.join(target,'activation-authority.json'),'utf8')), {allowTestHttp});
  const list = await manifest(target);
  const gate = new InstallationGate({root:target,store,machineHash,publicKey:config.publicKey});
  const ledger = await store.read();
  // Support retry after an interrupted uninstall, without allowing another installation to be retired.
  const marker = JSON.parse(await readFile(path.join(target,MARKER),'utf8'));
  if (ledger.current?.status === 'retired' && ledger.current.installationId === marker.installationId &&
      path.resolve(ledger.current.root) === path.resolve(target) && ledger.current.machineHash === machineHash) {
    // The first uninstall already invalidated this installation.
  } else await gate.retire();
  const directories = new Set();
  for (const file of list.files) {
    let full;
    try { full = await safeFile(target,file.path); }
    catch (error) { if(error.code === 'ENOENT')continue;throw error; }
    await unlink(full);
    let directory = path.dirname(full);
    while (directory !== target && directory.startsWith(target+path.sep)) {directories.add(directory);directory=path.dirname(directory);}
  }
  for (const directory of [...directories].sort((a,b)=>b.length-a.length)) await rmdir(directory).catch(error=>{if(!['ENOTEMPTY','ENOENT'].includes(error.code))throw error;});
  for(const file of [MARKER,'managed-manifest.json'])await unlink(path.join(target,file));
  let remaining = false;
  await rmdir(target).catch(error=>{if(error.code!=='ENOTEMPTY')throw error;remaining=true;});
  return {remaining};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'win32') throw new Error('Managed setup requires Windows.');
  const source = fileURLToPath(new URL('../',import.meta.url));
  const base = path.join(process.env.LOCALAPPDATA,'Programs'), target=path.join(base,'PrintsMen Badge Studio');
  const store = new LicenceStore(defaultStateFile(),windowsProtection), machineHash=await windowsMachineHash();
  const action=process.argv[2];
  if(action==='install') {
    const installation=await installManaged({source,target,base,store,machineHash});
    const values={DisplayName:'PrintsMen Customised Studio (Managed)',Publisher:'PrintsMen',DisplayVersion:JSON.parse(await readFile(path.join(target,'package.json'),'utf8')).version,
      InstallLocation:target,UninstallString:'"'+process.execPath+'" "'+path.join(target,'setup','managed-install.mjs')+'" uninstall'};
    for(const [name,value] of Object.entries(values))await run('reg.exe',['add',registry,'/v',name,'/t','REG_SZ','/d',value,'/f'],{windowsHide:true});
    console.log('Installed, awaiting owner approval. Installation ID: '+installation.installationId+'\nOpen: '+path.join(target,'Start Badge Studio.cmd'));
  } else if(action==='uninstall') {
    const prompt=createInterface({input:process.stdin,output:process.stdout});
    const answer=await prompt.question('Save/export your work and close the studio first. Uninstall and permanently retire this activation? Type UNINSTALL: ');prompt.close();
    if(answer!=='UNINSTALL'){console.log('Uninstall cancelled.');process.exitCode=1;}
    else {await stopInstalledServer(target);const result=await uninstallManaged({target,base,store,machineHash});await run('reg.exe',['delete',registry,'/f'],{windowsHide:true}).catch(()=>{});
      console.log('Activation retired. Reinstalling needs a new key and owner approval. '+(result.remaining?'Unrecognised files were preserved in the installation directory.':'Application files removed.'));
    }
  } else throw new Error('Use install or uninstall.');
}
