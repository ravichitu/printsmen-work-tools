import {mkdir, readFile, writeFile, copyFile, lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeFiles} from '../PrintsMen Badge Studio/scripts/release-files.mjs';
import {validateAuthority} from '../PrintsMen Badge Studio/licensing/online.mjs';
import {LicenceStore} from '../PrintsMen Badge Studio/licensing/store.mjs';
import {windowsProtection} from '../PrintsMen Badge Studio/licensing/windows.mjs';
import {PRODUCT} from '../PrintsMen Badge Studio/licensing/licence.mjs';
import {createOperatorAuth} from '../PrintsMen Badge Studio/licensing/operator-auth.mjs';

export async function buildManagedBundle({appRoot, destination, config, operatorConfig, allowTestHttp=false}) {
  config=validateAuthority(config,{allowTestHttp});
  config={schema:1,url:config.url,publicKey:config.publicKey};
  operatorConfig ||= JSON.parse(await readFile(path.join(appRoot,'operator-auth.json'),'utf8'));
  createOperatorAuth(operatorConfig);
  if(await lstat(destination).then(()=>true,error=>{if(error.code!=='ENOENT')throw error;return false;}))throw new Error('Build destination already exists. Nothing was overwritten.');
  const names=await runtimeFiles(appRoot), payload=path.join(destination,'payload');
  await mkdir(payload,{recursive:true});
  for(const name of names){const target=path.join(payload,name);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(appRoot,name),target);}
  // The operator distribution has only the fail-closed server entry point, never the development entry point.
  await copyFile(path.join(appRoot,'managed-server.mjs'),path.join(payload,'server.mjs'));names.push('server.mjs');
  await writeFile(path.join(payload,'activation-authority.json'),JSON.stringify(config,null,2));names.push('activation-authority.json');
  const {schema,username,salt,passwordHash,temporary}=operatorConfig;
  await writeFile(path.join(payload,'operator-auth.json'),JSON.stringify({schema,username,salt,passwordHash,temporary},null,2));names.push('operator-auth.json');
  const files=[];
  for(const name of names)files.push({path:name,hash:createHash('sha256').update(await readFile(path.join(payload,name))).digest('hex')});
  await writeFile(path.join(payload,'managed-manifest.json'),JSON.stringify({schema:1,product:PRODUCT,files},null,2));
  await writeFile(path.join(destination,'Setup.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nnode payload\\setup\\managed-install.mjs install\r\npause\r\n');
  return {payload,files:files.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const ownerRoot=path.dirname(fileURLToPath(import.meta.url));
  const [url,destination]=process.argv.slice(2);
  if(!url||!destination)throw new Error('Usage: node build-managed.mjs https://YOUR-ACTIVATION-DOMAIN ABSOLUTE-OUTPUT-DIRECTORY');
  const state=await new LicenceStore(path.join(ownerRoot,'private','authority.dpapi'),windowsProtection).read();
  console.log(await buildManagedBundle({appRoot:path.resolve(ownerRoot,'../PrintsMen Badge Studio'),destination:path.resolve(destination),config:{schema:1,url,publicKey:state.publicKey}}));
}
