import {generateKeyPairSync, randomBytes, randomUUID, createHash, scrypt as derive, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {PRODUCT, authorityFingerprint, validateRequest, issueLicence} from '../PrintsMen Badge Studio/licensing/licence.mjs';
import {TOOL_CATALOG, validateTools} from '../PrintsMen Badge Studio/licensing/catalog.mjs';
import {validateClient,checkClientIdentity} from '../PrintsMen Badge Studio/licensing/client.mjs';

const scrypt = promisify(derive);
const keyHash = key => createHash('sha256').update(key).digest('hex');
const reject = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };
export async function newAuthority(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256) reject('Use an owner password of 14-256 characters.');
  const pair = generateKeyPairSync('ed25519');
  const salt = randomBytes(32).toString('hex');
  return {schema:1, product:PRODUCT, retired:[], current:null,
    privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}), publicKey:pair.publicKey.export({type:'spki',format:'pem'}),
    owner:{salt, hash:(await scrypt(password, salt, 64)).toString('hex')}, keys:[], requests:[]};
}

export async function checkPassword(state, password) {
  if (typeof password !== 'string' || password.length > 256) return false;
  const actual = await scrypt(password, state.owner.salt, 64);
  const expected = Buffer.from(state.owner.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateLicenceKey(state, {customer, tools, client, expiresAt=null}) {
  if (typeof customer !== 'string' || !customer.trim() || customer.trim().length > 120) reject('Enter a customer/shop name (1-120 characters).');
  tools = validateTools(tools);
  if(expiresAt!==null&&(typeof expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiresAt)||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()))reject('Expiry must be a future UTC date, or blank for installation lifetime.');
  if (state.keys.length >= 500) reject('This local prototype supports 500 keys. Archive/migrate the authority before adding more.', 409);
  const key = 'PM1-' + randomBytes(24).toString('base64url');
  const recoveryKey='PMR1-'+randomBytes(24).toString('base64url');
  const details=client===undefined?null:validateClient(client);
  const record = {id:randomUUID(), hash:keyHash(key), recoveryHash:keyHash(recoveryKey), customer:customer.trim(), client:details, tools, expiresAt, createdAt:new Date().toISOString(), boundInstallation:null};
  state.keys.push(record);
  return {key, recoveryKey, id:record.id, customer:record.customer, client:record.client, tools, expiresAt, createdAt:record.createdAt, boundInstallation:null};
}

export function recoverLicenceKey(state,{keyId,recoveryKey}){
  const previous=state.keys.find(k=>k.id===keyId);
  if(!previous||typeof recoveryKey!=='string'||!/^PMR1-[A-Za-z0-9_-]{32}$/.test(recoveryKey)||previous.recoveryHash!==keyHash(recoveryKey))reject('Recovery record or key is incorrect.',403);
  if(previous.replacedAt||previous.recoveryUsedAt)reject('Recovery key has already been used. Use the latest owner recovery sheet.',409);
  const issued=generateLicenceKey(state,{customer:previous.customer,client:previous.client??undefined,tools:[...previous.tools],expiresAt:previous.expiresAt??null});
  const now=new Date().toISOString();previous.replacedAt=now;previous.recoveryUsedAt=now;previous.replacementKeyId=issued.id;
  state.keys.find(k=>k.id===issued.id).recoveredFrom=previous.id;
  for(const request of state.requests)if(request.keyId===previous.id&&request.state==='pending'){request.state='rejected';request.decidedAt=now;}
  return {...issued,recoveredFrom:previous.id,message:'Replacement issued. New installation needs owner approval. The old key cannot request another activation; an already activated offline copy is not remotely disabled.'};
}

export function requestActivation(state, input) {
  validateRequest(input);
  if (input.authorityFingerprint !== authorityFingerprint(state.publicKey)) reject('This installation trusts a different authority.', 403);
  if (typeof input.licenceKey !== 'string' || !/^PM1-[A-Za-z0-9_-]{32}$/.test(input.licenceKey)) reject('A valid owner-issued licence key is required.', 403);
  const key = state.keys.find(key => key.hash === keyHash(input.licenceKey));
  if (!key) reject('Licence key not recognised.', 403);
  if(key.replacedAt)reject('This key was replaced through owner recovery. Use the new key.',403);
  if(key.expiresAt&&Date.parse(key.expiresAt)<=Date.now())reject('Licence key has expired. Contact the owner.',403);
  if(key.client){try{checkClientIdentity(key,input);}catch(error){reject(error.message,403);}}
  if (key.boundInstallation && key.boundInstallation !== input.installationId) reject('This key is already bound to another installation. Reinstalling requires a new key and owner approval.', 409);
  let request = state.requests.find(request => request.installationId === input.installationId);
  if (request && (request.challenge !== input.challenge || request.machineHash !== input.machineHash || request.keyId !== key.id)) reject('This installation already has a different activation request.', 409);
  if (!request) {
    if (state.requests.length >= 1000) reject('Activation request limit reached. Contact the owner.', 429);
    request = {schema:1, type:'activation-request', product:PRODUCT, installationId:input.installationId,
      machineHash:input.machineHash, authorityFingerprint:input.authorityFingerprint, challenge:input.challenge,
      keyId:key.id, customer:key.customer, client:key.client||null, tools:[...key.tools], expiresAt:key.expiresAt||null, state:'pending', receivedAt:new Date().toISOString(),
      approvedAt:null, confirmedAt:null, licence:null};
    state.requests.push(request);
  }
  return request.state === 'approved' ? {state:'approved', licence:request.licence} :
    {state:request.state, message:request.state === 'rejected' ? 'The owner rejected this installation request. Contact the owner.' : 'Request received. The owner must approve this installation in the dashboard.'};
}

export function decideActivation(state, installationId, decision) {
  if (!['approve','reject'].includes(decision)) reject('Invalid activation decision.');
  const request = state.requests.find(request => request.installationId === installationId);
  if (!request) reject('Activation request not found.', 404);
  if (request.state !== 'pending') reject('This request has already been decided.', 409);
  if (decision === 'reject') { request.state = 'rejected'; request.decidedAt = new Date().toISOString(); return; }
  const key = state.keys.find(key => key.id === request.keyId);
  if (!key || key.boundInstallation) reject('This key has already been used. Generate a new key for the other installation.', 409);
  if(key.replacedAt||(key.expiresAt&&Date.parse(key.expiresAt)<=Date.now()))reject('This key has been replaced or expired.',409);
  request.licence = issueLicence(request, state.privateKey, request.customer, request.tools, request.client, request.expiresAt);
  request.approvedAt = JSON.parse(Buffer.from(request.licence.payload, 'base64url').toString('utf8')).issuedAt;
  request.state = 'approved';
  key.boundInstallation = request.installationId;
}

export function confirmActivation(state, input) {
  validateRequest(input);
  const request = state.requests.find(request => request.installationId === input.installationId);
  if (!request || request.challenge !== input.challenge || request.machineHash !== input.machineHash || request.authorityFingerprint !== input.authorityFingerprint || request.state !== 'approved') reject('Activation approval not found.', 403);
  const payload = JSON.parse(Buffer.from(request.licence.payload, 'base64url').toString('utf8'));
  if (payload.licenceId !== input.licenceId) reject('Activation receipt does not match.', 403);
  request.confirmedAt ||= new Date().toISOString();
  return {state:'confirmed', confirmedAt:request.confirmedAt};
}

export function dashboard(state) {
  return {tools:TOOL_CATALOG, authorityFingerprint:authorityFingerprint(state.publicKey),
    keys:state.keys.map(({hash, recoveryHash, ...key}) => key),
    requests:state.requests.map(({challenge, licence, machineHash, ...request}) => ({...request, machineLabel:machineHash.slice(0,12),
      status:request.confirmedAt ? 'Activated (client confirmed)' : request.state === 'approved' ? 'Approved; awaiting client' : request.state}))};
}
