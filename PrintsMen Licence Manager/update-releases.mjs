import {generateKeyPairSync,sign} from 'node:crypto';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LicenceStore} from '../PrintsMen Badge Studio/licensing/store.mjs';
import {windowsProtection} from '../PrintsMen Badge Studio/licensing/windows.mjs';
import {UPDATE_PRODUCT,MAX_INSTALLER,sha256,httpsURL,versionParts,updateConfig} from '../PrintsMen Badge Studio/updates/release.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const store=new LicenceStore(path.join(root,'private','update-signing.dpapi'),windowsProtection);
const [action,...args]=process.argv.slice(2);
if(action==='init'){
  await store.change(state=>{
    if(state.updateSigning)throw new Error('An update signing key already exists. It was not replaced.');
    const keys=generateKeyPairSync('ed25519');
    state.updateSigning={createdAt:new Date().toISOString(),publicKey:keys.publicKey.export({type:'spki',format:'pem'}),privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'})};
  },{allowNew:true});
  console.log('Owner-only update signing key created under private/. Windows DPAPI protects it. Keep it off operator PCs.');
}else if(action==='configure'){
  const {updateSigning}=await store.read();if(!updateSigning)throw new Error('Initialize the owner update key first.');
  const feedUrl=args[0]==='--offline'?'':httpsURL(args[0]);
  const config={schema:1,channel:'preview',feedUrl,publicKey:updateSigning.publicKey,checkIntervalHours:6};updateConfig(config);
  await writeFile(path.join(root,'..','PrintsMen Badge Studio','updates-config.json'),JSON.stringify(config,null,2)+'\n');
  console.log(feedUrl?'Public verification key and HTTPS feed configured for the next build.':'Public verification key pinned for the next build. Network updates stay disabled until hosting is configured.');
}else if(action==='publish'){
  const [installer,version,url,output,notes='PrintsMen application update.']=args;
  versionParts(version);httpsURL(url);
  if(!output)throw new Error('Provide a NEW signed feed output path.');
  const stat=await lstat(installer);if(!stat.isFile()||stat.size>MAX_INSTALLER)throw new Error('Invalid installer file.');
  const bytes=await readFile(installer);if(bytes[0]!==0x4d||bytes[1]!==0x5a)throw new Error('Expected a Windows executable.');
  const {updateSigning}=await store.read();if(!updateSigning)throw new Error('Initialize the owner update key first.');
  if(notes.length>4000)throw new Error('Release notes exceed 4000 characters.');
  const data={schema:1,product:UPDATE_PRODUCT,channel:'preview',version,url,bytes:bytes.length,sha256:sha256(bytes),publishedAt:new Date().toISOString(),notes};
  const payload=Buffer.from(JSON.stringify(data));
  await writeFile(output,JSON.stringify({payload:payload.toString('base64url'),signature:sign(null,payload,updateSigning.privateKey).toString('base64url')},null,2),{flag:'wx'});
  console.log('Signed feed created. Publish it and the matching installer on your HTTPS hosting. The private key was not exported.');
}else throw new Error('Use init; configure HTTPS-FEED-URL (or --offline); or publish INSTALLER VERSION HTTPS-INSTALLER-URL NEW-OUTPUT-JSON [NOTES].');
