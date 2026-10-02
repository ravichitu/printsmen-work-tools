import {createHash, createPublicKey, randomUUID, sign, verify} from 'node:crypto';
import {TOOL_CATALOG, validateTools} from './catalog.mjs';
import {validateClient} from './client.mjs';

export const PRODUCT = 'printsmen-badge-studio';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const fail = message => { throw new Error(message); };

export function authorityFingerprint(publicKey) {
  const key = createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519') fail('The licence authority must use Ed25519.');
  return createHash('sha256').update(key.export({type:'spki', format:'der'})).digest('hex');
}

export function validateRequest(request) {
  if (!request || request.schema !== 1 || request.type !== 'activation-request' || request.product !== PRODUCT ||
      !UUID.test(request.installationId) || !HASH.test(request.machineHash) || !HASH.test(request.authorityFingerprint) || !HASH.test(request.challenge)) {
    fail('Invalid activation request.');
  }
  return request;
}

export function createRequest(installation) {
  return validateRequest({schema:1, type:'activation-request', product:PRODUCT,
    installationId:installation.installationId, machineHash:installation.machineHash,
    authorityFingerprint:installation.authorityFingerprint, challenge:installation.challenge});
}

export function issueLicence(request, privateKey, customer, tools = TOOL_CATALOG.map(tool => tool.id), client=null, expiresAt=null) {
  validateRequest(request);
  const publicKey = createPublicKey(privateKey).export({type:'spki', format:'pem'});
  if (request.authorityFingerprint !== authorityFingerprint(publicKey)) fail('This request belongs to a different licence authority.');
  if (typeof customer !== 'string' || !customer.trim() || customer.trim().length > 120) fail('Enter a customer/shop name (1-120 characters).');
  if(expiresAt!==null&&(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()))fail('Licence expiry must be in the future.');
  const payload = Buffer.from(JSON.stringify({schema:1, type:expiresAt?'expiring-installation-licence':'permanent-installation-licence', product:PRODUCT,
    licenceId:randomUUID(), installationId:request.installationId, machineHash:request.machineHash,
    authorityFingerprint:request.authorityFingerprint, challenge:request.challenge, term:expiresAt?'fixed-expiry':'installation-lifetime',
    tools:validateTools(tools), customer:customer.trim(), ...(client?{client:validateClient(client)}:{}), ...(expiresAt?{expiresAt}:{}), issuedAt:new Date().toISOString()}));
  return {payload:payload.toString('base64url'), signature:sign(null, payload, privateKey).toString('base64url')};
}

export function verifyLicence(envelope, publicKey, installation) {
  if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string' ||
      envelope.payload.length > 8192 || envelope.signature.length !== 86 ||
      !/^[A-Za-z0-9_-]+$/.test(envelope.payload) || !/^[A-Za-z0-9_-]+$/.test(envelope.signature)) fail('Invalid licence file.');
  const payload = Buffer.from(envelope.payload, 'base64url');
  const signature = Buffer.from(envelope.signature, 'base64url');
  if (payload.toString('base64url') !== envelope.payload || signature.toString('base64url') !== envelope.signature ||
      !verify(null, payload, publicKey, signature)) fail('The licence signature is not valid.');
  const data = JSON.parse(payload.toString('utf8'));
  const validTerm=(data.type==='permanent-installation-licence'&&data.term==='installation-lifetime'&&!data.expiresAt)||(data.type==='expiring-installation-licence'&&data.term==='fixed-expiry'&&typeof data.expiresAt==='string');
  if (data.schema !== 1 || !validTerm || data.product !== PRODUCT ||
      !UUID.test(data.licenceId) || typeof data.customer !== 'string' ||
      !data.customer.trim() || data.customer.length > 120 || !Number.isFinite(Date.parse(data.issuedAt))) fail('Unsupported licence contents.');
  validateTools(data.tools);
  if(data.client)validateClient(data.client);
  if(data.expiresAt&&(!Number.isFinite(Date.parse(data.expiresAt))||Date.parse(data.expiresAt)<=Date.now()))fail('This licence has expired. Contact the owner.');
  if (data.installationId !== installation.installationId || data.machineHash !== installation.machineHash || data.challenge !== installation.challenge) {
    fail('This approval is for another installation. Reinstalling requires a new owner approval.');
  }
  if (data.authorityFingerprint !== authorityFingerprint(publicKey) || data.authorityFingerprint !== installation.authorityFingerprint) {
    fail('The licence authority does not match this installation.');
  }
  return data;
}
