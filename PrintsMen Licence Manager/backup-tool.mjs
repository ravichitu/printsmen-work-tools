import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {lstat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LicenceStore} from '../PrintsMen Badge Studio/licensing/store.mjs';
import {windowsProtection} from '../PrintsMen Badge Studio/licensing/windows.mjs';
import {authenticateOwner, audit} from './security.mjs';
import {encryptBackup, decryptBackup, readBackup, backupSummary, restoreBackup} from './backup.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const [action,file,destination,...extra] = process.argv.slice(2);
const help = 'Use: node backup-tool.mjs export NEW-BACKUP-FILE\n     node backup-tool.mjs verify BACKUP-FILE\n     node backup-tool.mjs restore BACKUP-FILE NEW-PRIVATE-DIRECTORY\nPasswords are entered interactively, never as command-line arguments.';

async function main() {
  if (action === '--help') { console.log(help); return; }
  if (!['export','verify','restore'].includes(action) || !file || extra.length || (action === 'restore' ? !destination : !!destination)) throw new Error(help);
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal. Passwords must not be passed in command arguments or environment variables.');
  if (action === 'export' || action === 'restore') {
    const target = action === 'export' ? file : destination;
    try { await lstat(target); throw new Error('Destination already exists. Choose a new path; nothing was overwritten.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let muted = false;
  const output = new Writable({write(chunk,encoding,callback) { if (!muted) process.stdout.write(chunk,encoding); callback(); }});
  const prompt = createInterface({input:process.stdin,output,terminal:true});
  async function ask(label, secret = false) {
    process.stdout.write(label); muted = secret;
    try { return await prompt.question(''); }
    finally { muted = false; if (secret) process.stdout.write('\n'); }
  }
  try {
    if (action === 'export') {
      const store = new LicenceStore(path.join(root,'private','authority.dpapi'),windowsProtection);
      const password = await ask('Owner password: ',true);
      const code = (await ask('Authenticator / owner recovery code (blank if MFA not enabled): ',true)).trim();
      const passphrase = await ask('NEW backup passphrase (16+ characters; keep separately): ',true);
      const confirm = await ask('Confirm backup passphrase: ',true);
      if (passphrase !== confirm || passphrase === password) throw new Error('Backup passphrases must match and differ from your owner password.');
      let updates = null;
      try { updates = await new LicenceStore(path.join(root,'private','update-signing.dpapi'),windowsProtection).read(); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const encrypted = await store.change(async state => {
        await authenticateOwner(state,password,code);
        audit(state,'owner.backup-exported');
        return encryptBackup({authority:state,updates},passphrase);
      });
      const verified = await decryptBackup(encrypted,passphrase);
      await writeFile(file,JSON.stringify(encrypted,null,2)+'\n',{flag:'wx',mode:0o600});
      console.log('Encrypted backup written and cryptographically verified. No plaintext keys were written.');
      console.log(JSON.stringify(backupSummary(verified),null,2));
    } else {
      const passphrase = await ask('Backup passphrase: ',true);
      const payload = await readBackup(file,passphrase);
      console.log(JSON.stringify(backupSummary(payload),null,2));
      if (action === 'verify') { console.log('Backup is readable. A restore drill is still required.'); return; }
      console.log('Restore creates a NEW private directory under this Windows account. It does not replace or start a live authority. Stop the old host before switching.');
      console.log('MFA and old owner recovery codes will be reset. Public activation remains blocked until you enrol a new authenticator. Changes since this backup need reconciliation.');
      if (await ask('Type RESTORE to continue: ') !== 'RESTORE') throw new Error('Restore cancelled.');
      const newOwnerPassword = await ask('New owner password (14+ characters): ',true);
      if (await ask('Confirm new owner password: ',true) !== newOwnerPassword) throw new Error('Passwords did not match.');
      await restoreBackup(payload,destination,windowsProtection,{newOwnerPassword});
      console.log('Restored into the new directory with Windows account protection. Follow SECURITY-AND-RECOVERY.md before switching hosts.');
    }
  } finally { prompt.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
