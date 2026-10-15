import {mkdir, readFile, writeFile, copyFile, lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeFiles} from '../PrintsMen Badge Studio/scripts/release-files.mjs';
import {validateAuthority} from '../PrintsMen Badge Studio/licensing/online.mjs';
import {LicenceStore} from '../PrintsMen Badge Studio/licensing/store.mjs';
import {windowsProtection} from '../PrintsMen Badge Studio/licensing/windows.mjs';
import {PRODUCT} from '../PrintsMen Badge Studio/licensing/licence.mjs';
import {createOperatorAuth,makeOperatorConfig} from '../PrintsMen Badge Studio/licensing/operator-auth.mjs';
import {createInterface} from 'node:readline';

export async function buildManagedBundle({appRoot, destination, config, operatorConfig, allowTestHttp=false}) {
  config=validateAuthority(config,{allowTestHttp});
  config=config.mode==='offline'?{schema:1,mode:'offline',publicKey:config.publicKey}:{schema:1,url:config.url,publicKey:config.publicKey};
  operatorConfig ||= JSON.parse(await readFile(path.join(appRoot,'operator-auth.json'),'utf8'));
  createOperatorAuth(operatorConfig);
  if(await lstat(destination).then(()=>true,error=>{if(error.code!=='ENOENT')throw error;return false;}))throw new Error('Build destination already exists. Nothing was overwritten.');
  const names=await runtimeFiles(appRoot), payload=path.join(destination,'payload');
  await mkdir(payload,{recursive:true});
  for(const name of names){const target=path.join(payload,name);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(appRoot,name),target);}
  // The operator distribution has only the fail-closed server entry point, never the development entry point.
  await copyFile(path.join(appRoot,'managed-server.mjs'),path.join(payload,'server.mjs'));names.push('server.mjs');
  await writeFile(path.join(payload,'activation-authority.json'),JSON.stringify(config,null,2));names.push('activation-authority.json');
  const {schema,username,salt,passwordHash,temporary,localOnly}=operatorConfig;
  await writeFile(path.join(payload,'operator-auth.json'),JSON.stringify({schema,username,salt,passwordHash,temporary,localOnly},null,2));names.push('operator-auth.json');
  const files=[];
  for(const name of names)files.push({path:name,hash:createHash('sha256').update(await readFile(path.join(payload,name))).digest('hex')});
  await writeFile(path.join(payload,'managed-manifest.json'),JSON.stringify({schema:1,product:PRODUCT,files},null,2));
  await writeFile(path.join(destination,'Setup.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nnode payload\\setup\\managed-install.mjs install\r\npause\r\n');
  return {payload,files:files.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const ownerRoot=path.dirname(fileURLToPath(import.meta.url));
  const [url,destination]=process.argv.slice(2);
  if(!url||!destination)throw new Error("Usage: node build-managed.mjs 'offline'|https://YOUR-ACTIVATION-DOMAIN ABSOLUTE-OUTPUT-DIRECTORY");
  const state=await new LicenceStore(path.join(ownerRoot,'private','authority.dpapi'),windowsProtection).read();
  let operatorConfig;
  if(url==='offline'){
    const prompt=createInterface({input:process.stdin,output:process.stdout});
    const username=(await new Promise(resolve=>prompt.question('Offline operator username for this client package: ',resolve))).trim();prompt.close();
    const readHidden=label=>new Promise((resolve,reject)=>{
      const input=process.stdin;if(!input.isTTY||typeof input.setRawMode!=='function')return reject(new Error('Run the offline package build in an interactive terminal so the password is not echoed.'));
      let value='';process.stdout.write(label);input.setEncoding('utf8');input.setRawMode(true);input.resume();
      const finish=(error)=>{input.removeListener('data',onData);input.setRawMode(false);input.pause();process.stdout.write('\n');error?reject(error):resolve(value);};
      const onData=chunk=>{for(const char of chunk){if(char==='\u0003')return finish(new Error('Password entry cancelled.'));if(char==='\r'||char==='\n')return finish();if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char;}};
      input.on('data',onData);
    });
    const password=await readHidden('Offline operator password (minimum 12 characters): '),confirmation=await readHidden('Re-enter password: ');
    if(password.length<12)throw new Error('Use at least 12 characters for this offline operator password. No managed bundle was created.');
    if(password!==confirmation)throw new Error('Passwords do not match. No managed bundle was created.');
    operatorConfig={...await makeOperatorConfig(username,password),temporary:false,localOnly:true};
  }
  console.log(await buildManagedBundle({appRoot:path.resolve(ownerRoot,'../PrintsMen Badge Studio'),destination:path.resolve(destination),operatorConfig,config:url==='offline'?{schema:1,mode:'offline',publicKey:state.publicKey}:{schema:1,url,publicKey:state.publicKey}}));
}
