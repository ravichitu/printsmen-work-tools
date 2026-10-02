import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LicenceStore} from '../PrintsMen Badge Studio/licensing/store.mjs';
import {windowsProtection} from '../PrintsMen Badge Studio/licensing/windows.mjs';
import {newAuthority} from './authority.mjs';

const file=path.join(path.dirname(fileURLToPath(import.meta.url)),'private','authority.dpapi');
const exists=await access(file).then(()=>true,()=>false);
if(exists){console.log('Owner authority is already configured. Existing keys were not changed.');}
else {
  if(!process.stdin.isTTY)throw new Error('Run owner setup in an interactive Windows terminal to choose a private password.');
  let muted=false;
  const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});
  const prompt=createInterface({input:process.stdin,output,terminal:true});
  console.log('Create the owner dashboard password. This utility stays on YOUR computer, not an operator PC.');
  process.stdout.write('Password (at least 14 characters; hidden): ');muted=true;
  const password=await prompt.question('');
  muted=false;process.stdout.write('\nConfirm password: ');muted=true;
  const confirm=await prompt.question('');muted=false;process.stdout.write('\n');prompt.close();
  if(password!==confirm)throw new Error('Passwords did not match. Nothing was created.');
  const state=await newAuthority(password);
  await new LicenceStore(file,windowsProtection).change(ledger=>Object.assign(ledger,state),{allowNew:true});
  console.log('Owner authority created. Windows protects the signing key and licence records for this account. Keep this account and its backups safe.');
}
