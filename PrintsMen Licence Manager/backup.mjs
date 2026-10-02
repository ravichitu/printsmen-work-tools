import {createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, randomBytes, randomUUID, scrypt as derive} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir, readFile, open, lstat, unlink, rmdir} from 'node:fs/promises';
import path from 'node:path';
import {PRODUCT, authorityFingerprint} from '../PrintsMen Badge Studio/licensing/licence.mjs';
import {audit, changeOwnerPassword} from './security.mjs';

const scrypt = promisify(derive);
const FORMAT = 'printsmen-owner-backup';
const KDF = {name:'scrypt',N:131072,r:8,p:1};
const AAD = Buffer.from(FORMAT + ':1:aes-256-gcm:scrypt-131072-8-1');
export const MAX_BACKUP_BYTES = 2_000_000;

function passphraseCheck(value) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 256) throw new Error('Use a backup passphrase of 16-256 characters.');
}

function validatePair(pair) {
  const key = createPrivateKey(pair.privateKey);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Invalid signing key type.');
  const derived = createPublicKey(key).export({type:'spki',format:'pem'});
  const supplied = createPublicKey(pair.publicKey).export({type:'spki',format:'pem'});
  if (derived !== supplied) throw new Error('Backup signing keys do not match.');
}

export function validateBackupPayload(payload) {
  if (payload?.schema !== 1 || payload.product !== PRODUCT) throw new Error('Invalid backup payload.');
  const state = payload.authority;
  if (state?.schema !== 1 || state.product !== PRODUCT || !Array.isArray(state.retired) ||
      !Array.isArray(state.keys) || !Array.isArray(state.requests) || !state.owner ||
      !/^[a-f0-9]{64}$/.test(state.owner.salt) || !/^[a-f0-9]{128}$/.test(state.owner.hash)) throw new Error('Invalid authority backup.');
  validatePair(state);
  if (state.owner.mfa && (!/^[A-Z2-7]{32}$/.test(state.owner.mfa.secret) ||
      !Number.isSafeInteger(state.owner.mfa.lastCounter) || !Array.isArray(state.owner.mfa.recoveryHashes) ||
      state.owner.mfa.recoveryHashes.some(hash => !/^[a-f0-9]{64}$/.test(hash)))) throw new Error('Invalid MFA backup.');
  if (payload.updates !== null) {
    if (payload.updates?.schema !== 1 || payload.updates.product !== PRODUCT || !Array.isArray(payload.updates.retired)) throw new Error('Invalid update key backup.');
    validatePair(payload.updates.updateSigning);
  }
  return payload;
}

export async function encryptBackup({authority,updates = null}, passphrase) {
  passphraseCheck(passphrase);
  const payload = validateBackupPayload({schema:1,product:PRODUCT,createdAt:new Date().toISOString(),authority,updates});
  const plaintext = Buffer.from(JSON.stringify(payload));
  if (plaintext.length > 1_400_000) throw new Error('Backup exceeds its size limit.');
  const salt = randomBytes(32), iv = randomBytes(12);
  const key = await scrypt(passphrase, salt, 32, {...KDF,maxmem:256 * 1024 * 1024});
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext),cipher.final()]);
    return {format:FORMAT,schema:1,cipher:'aes-256-gcm',kdf:{...KDF,salt:salt.toString('base64')},iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  } finally { key.fill(0); plaintext.fill(0); }
}

function decode(value, exact, max = exact) {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid backup encoding.');
  const bytes = Buffer.from(value, 'base64');
  if ((exact !== null && bytes.length !== exact) || bytes.length > max || bytes.toString('base64') !== value) throw new Error('Invalid backup size.');
  return bytes;
}

export async function decryptBackup(envelope, passphrase) {
  passphraseCheck(passphrase);
  if (Buffer.byteLength(JSON.stringify(envelope)) > MAX_BACKUP_BYTES || envelope?.format !== FORMAT || envelope.schema !== 1 ||
      envelope.cipher !== 'aes-256-gcm' || envelope.kdf?.name !== KDF.name || envelope.kdf.N !== KDF.N ||
      envelope.kdf.r !== KDF.r || envelope.kdf.p !== KDF.p) throw new Error('Unsupported or oversized backup.');
  const salt = decode(envelope.kdf.salt,32), iv = decode(envelope.iv,12), tag = decode(envelope.tag,16);
  const ciphertext = decode(envelope.ciphertext,null,1_400_000);
  const key = await scrypt(passphrase, salt, 32, {...KDF,maxmem:256 * 1024 * 1024});
  let plaintext;
  try {
    const decipher = createDecipheriv('aes-256-gcm',key,iv); decipher.setAAD(AAD); decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext),decipher.final()]);
    return validateBackupPayload(JSON.parse(plaintext.toString('utf8')));
  } catch { throw new Error('Backup password is incorrect, or the backup is damaged/invalid.'); }
  finally { key.fill(0); plaintext?.fill(0); }
}

export async function readBackup(file, passphrase) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.size > MAX_BACKUP_BYTES) throw new Error('Expected a regular backup file within its size limit.');
  return decryptBackup(JSON.parse(await readFile(file,'utf8')),passphrase);
}

export function backupSummary(payload) {
  return {createdAt:payload.createdAt,authorityFingerprint:authorityFingerprint(payload.authority.publicKey),
    keys:payload.authority.keys.length,requests:payload.authority.requests.length,
    mfaEnabled:!!payload.authority.owner.mfa,updateSigningIncluded:!!payload.updates};
}

// Restore only to an exclusively-created directory; never overwrite a live owner.
export async function restoreBackup(payload, destination, protection, {newOwnerPassword} = {}) {
  validateBackupPayload(payload);
  const root = path.resolve(destination), state = structuredClone(payload.authority);
  state.owner.sessionVersion = randomUUID();
  if (state.owner.mfa) state.owner.mfa.recoveryHashes = [];
  if (newOwnerPassword !== undefined) {
    await changeOwnerPassword(state,newOwnerPassword);
    delete state.owner.mfa;
  }
  audit(state,'owner.backup-restored');
  const files = [['authority.dpapi',await protection.protect(JSON.stringify(state))]];
  if (payload.updates) files.push(['update-signing.dpapi',await protection.protect(JSON.stringify(payload.updates))]);
  if (files.some(([,value]) => value.length > 1e6)) throw new Error('Restored state exceeds the current local store limit.');
  await mkdir(root);
  const written = [];
  try {
    for (const [name,value] of files) {
      const file = path.join(root,name), handle = await open(file,'wx',0o600); written.push(file);
      try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
    }
    return {...backupSummary(payload),destination:root};
  } catch (error) {
    for (const file of written) await unlink(file).catch(() => {});
    await rmdir(root).catch(() => {});
    throw error;
  }
}
