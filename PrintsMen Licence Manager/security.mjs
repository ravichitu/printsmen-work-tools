import {createHmac, createHash, randomBytes, randomUUID, timingSafeEqual, scrypt as derive} from 'node:crypto';
import {promisify} from 'node:util';
import {checkPassword} from './authority.mjs';

const scrypt = promisify(derive);
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw Object.assign(new Error(message), {status:401}); };

export function encodeBase32(bytes) {
  let value = 0, bits = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; output += alphabet[(value >>> bits) & 31]; }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(secret) {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{32}$/.test(secret)) throw new Error('Invalid authenticator secret.');
  let value = 0, bits = 0; const bytes = [];
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  return Buffer.from(bytes);
}

export function totp(secret, counter, digits = 6) {
  if (!Number.isSafeInteger(counter) || counter < 0 || ![6,8].includes(digits)) throw new Error('Invalid authenticator counter.');
  const input = Buffer.alloc(8); input.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', decodeBase32(secret)).update(input).digest();
  const number = mac.readUInt32BE(mac[mac.length - 1] & 15) & 0x7fffffff;
  return String(number % (10 ** digits)).padStart(digits, '0');
}

function matchingCounter(secret, code, after = -1, now = Date.now()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const offset of [0,-1,1]) {
    const counter = current + offset;
    if (counter < 0 || counter <= after) continue;
    if (timingSafeEqual(Buffer.from(totp(secret, counter)), Buffer.from(code))) return counter;
  }
  return null;
}

export const sessionVersion = state => state.owner.sessionVersion || 'legacy';

export function audit(state, event, {actor = 'owner', target = null} = {}) {
  state.audit ||= [];
  state.audit.push({id:randomUUID(),at:new Date().toISOString(),event,actor,target});
  if (state.audit.length > 500) {
    state.auditDropped = (state.auditDropped || 0) + state.audit.length - 500;
    state.audit.splice(0, state.audit.length - 500);
  }
}

export function securitySummary(state) {
  return {
    mfaEnabled: !!state.owner.mfa,
    mfaEnabledAt: state.owner.mfa?.enabledAt || null,
    recoveryCodesRemaining: state.owner.mfa?.recoveryHashes.length || 0,
    passwordChangedAt: state.owner.passwordChangedAt || null,
    audit: (state.audit || []).slice(-100).reverse(), auditDropped: state.auditDropped || 0,
  };
}

// Call inside store.change: the accepted counter/recovery hash must commit once.
export function consumeFactor(state, code, now = Date.now()) {
  const mfa = state.owner.mfa;
  if (!mfa) return 'password-only';
  if (typeof code === 'string' && /^PMO-[A-F0-9]{24}$/.test(code)) {
    const index = mfa.recoveryHashes.indexOf(digest(code));
    if (index >= 0) {
      mfa.recoveryHashes.splice(index, 1);
      state.owner.sessionVersion = randomUUID();
      audit(state, 'owner.recovery-code-used');
      return 'recovery-code';
    }
  }
  const counter = matchingCounter(mfa.secret, code, mfa.lastCounter, now);
  if (counter === null) fail('Authenticator code is incorrect, expired or already used. Wait for a fresh code, or use an unused owner recovery code.');
  mfa.lastCounter = counter;
  return 'authenticator';
}

export async function authenticateOwner(state, password, code) {
  if (!await checkPassword(state, password)) fail('Owner credentials are incorrect.');
  const method = consumeFactor(state, code);
  return {version:sessionVersion(state),method};
}

export function beginEnrollment(now = Date.now()) {
  return {secret:encodeBase32(randomBytes(20)),expires:now + 5 * 60000};
}

export function enableMfa(state, pending, code, now = Date.now()) {
  if (!pending || pending.expires <= now) fail('Authenticator setup expired. Start setup again.');
  const counter = matchingCounter(pending.secret, code, -1, now);
  if (counter === null) fail('Enter the current six-digit code from the new authenticator entry.');
  const recoveryCodes = Array.from({length:10}, () => 'PMO-' + randomBytes(12).toString('hex').toUpperCase());
  state.owner.mfa = {secret:pending.secret,lastCounter:counter,recoveryHashes:recoveryCodes.map(digest),enabledAt:new Date(now).toISOString()};
  state.owner.sessionVersion = randomUUID();
  audit(state, 'owner.mfa-enabled');
  return {recoveryCodes};
}

export async function changeOwnerPassword(state, password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) {
    throw Object.assign(new Error('Use a new owner password of 14-256 characters.'), {status:400});
  }
  const salt = randomBytes(32).toString('hex');
  state.owner.salt = salt;
  state.owner.hash = (await scrypt(password, salt, 64)).toString('hex');
  state.owner.passwordChangedAt = new Date().toISOString();
  state.owner.sessionVersion = randomUUID();
  audit(state, 'owner.password-changed');
}
