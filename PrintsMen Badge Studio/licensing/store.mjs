import {mkdir, readFile, rename, open, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {PRODUCT} from './licence.mjs';

export class LicenceStore {
  constructor(file, protection) { this.file = file; this.protection = protection; }
  async read() {
    const encrypted = await readFile(this.file, 'utf8');
    if (encrypted.length > 1e6) throw new Error('Licence state exceeds its size limit.');
    if (encrypted !== this.cachedCipher) {
      const value = JSON.parse(await this.protection.unprotect(encrypted));
      if (value.schema !== 1 || value.product !== PRODUCT || !Array.isArray(value.retired)) throw new Error('Invalid installation ledger.');
      this.cachedValue = value;
      this.cachedCipher = encrypted;
    }
    return structuredClone(this.cachedValue);
  }
  async change(update, {allowNew = false} = {}) {
    await mkdir(path.dirname(this.file), {recursive:true});
    const lockName = this.file + '.lock';
    let lock;
    for (let n = 0; n < 40; n++) {
      try { lock = await open(lockName, 'wx', 0o600); break; }
      catch (error) { if (error.code !== 'EEXIST') throw error; await new Promise(r => setTimeout(r, 50)); }
    }
    if (!lock) throw new Error('Licence state is busy. Close setup/activation and try again.');
    const temp = this.file + '.' + randomUUID() + '.tmp';
    try {
      let ledger;
      try { ledger = await this.read(); }
      catch (error) {
        if (!allowNew || error.code !== 'ENOENT') throw error;
        ledger = {schema:1, product:PRODUCT, current:null, retired:[]};
      }
      const result = await update(ledger);
      const protectedState = await this.protection.protect(JSON.stringify(ledger));
      if (protectedState.length > 1e6) throw new Error('Local licence storage is full. Contact the owner before adding more records.');
      const output = await open(temp,'wx',0o600);
      try { await output.writeFile(protectedState); await output.sync(); }
      finally { await output.close(); }
      await rename(temp, this.file);
      this.cachedCipher = undefined;
      return result;
    } finally {
      try { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
      finally { await lock.close(); await unlink(lockName); }
    }
  }
}
