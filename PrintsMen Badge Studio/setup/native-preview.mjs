import {readFile, writeFile, realpath, lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {stopInstalledServer} from './managed-install.mjs';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const marker=path.join(root,'.preview-installation.json');
const manifest=JSON.parse(await readFile(path.join(root,'preview-manifest.json'),'utf8'));
if(manifest.product!=='printsmen-badge-studio-preview'||manifest.schema!==1||!Array.isArray(manifest.files))throw new Error('Invalid preview manifest.');
for(const entry of manifest.files){
  if(typeof entry.path!=='string'||entry.path.includes('\\')||entry.path.includes(':')||entry.path.split('/').some(part=>!part||part.startsWith('.')))throw new Error('Unsafe manifest path.');
  let current=root;
  for(const part of entry.path.split('/')){current=path.join(current,part);const stat=await lstat(current).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});if(stat?.isSymbolicLink())throw new Error('Linked files are not allowed in an installation.');}
}
if(process.argv[2]==='register'){
  for(const entry of manifest.files){const digest=createHash('sha256').update(await readFile(path.join(root,entry.path))).digest('hex');if(digest!==entry.hash)throw new Error('Installation integrity check failed: '+entry.path);}
  await writeFile(marker,JSON.stringify({schema:1,product:manifest.product,root,installationId:randomUUID(),installedAt:new Date().toISOString(),edition:'local-preview'}),{flag:'wx'});
  console.log('Local preview registered. Production licensing is disabled.');
}else if(process.argv[2]==='uninstall-check'){
  const record=JSON.parse(await readFile(marker,'utf8'));
  if(record.product!==manifest.product||record.root.toLowerCase()!==root.toLowerCase())throw new Error('This is not the registered preview directory.');
  await stopInstalledServer(root,Number(process.env.PORT||4188));
  console.log('Preview server stopped. Application-owned files can be removed.');
}else throw new Error('Use register or uninstall-check.');
