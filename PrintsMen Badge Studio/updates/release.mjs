import {createPublicKey,verify,createHash} from 'node:crypto';

export const UPDATE_PRODUCT='printsmen-badge-studio-preview';
export const MAX_INSTALLER=256*1024*1024;
export function versionParts(value){
  const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-preview\.(0|[1-9]\d*))?$/.exec(value);
  if(!match||match.slice(1).filter(v=>v!==undefined).some(v=>!Number.isSafeInteger(Number(v))))throw new Error('Invalid update version.');
  return [Number(match[1]),Number(match[2]),Number(match[3]),match[4]===undefined?Number.MAX_SAFE_INTEGER:Number(match[4])];
}
export function compareVersions(a,b){const x=versionParts(a),y=versionParts(b);for(let n=0;n<x.length;n++)if(x[n]!==y[n])return x[n]>y[n]?1:-1;return 0;}
export function httpsURL(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('Update addresses must use HTTPS without credentials or fragments.');
  return url.href;
}
export function updateConfig(value){
  if(value?.schema!==1||value.channel!=='preview')throw new Error('Invalid update configuration.');
  if(!value.feedUrl&&!value.publicKey)return {...value,configured:false};
  const key=createPublicKey(value.publicKey);
  if(key.asymmetricKeyType!=='ed25519')throw new Error('Updates require an Ed25519 verification key.');
  const hours=value.checkIntervalHours??6;
  if(!Number.isFinite(hours)||hours<1||hours>168)throw new Error('Invalid automatic check interval.');
  return {...value,feedUrl:value.feedUrl?httpsURL(value.feedUrl):'',checkIntervalHours:hours,configured:!!value.feedUrl};
}
export function verifyRelease(envelope,config){
  if(!config.configured||typeof envelope?.payload!=='string'||envelope.payload.length>22000||typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(envelope.signature))throw new Error('Invalid signed update feed.');
  const bytes=Buffer.from(envelope.payload,'base64url');
  if(bytes.toString('base64url')!==envelope.payload||!verify(null,bytes,config.publicKey,Buffer.from(envelope.signature,'base64url')))throw new Error('Update signature verification failed.');
  const data=JSON.parse(bytes.toString('utf8'));
  if(data.schema!==1||data.product!==UPDATE_PRODUCT||data.channel!==config.channel)throw new Error('This update belongs to another product or channel.');
  versionParts(data.version);httpsURL(data.url);
  if(!Number.isSafeInteger(data.bytes)||data.bytes<1||data.bytes>MAX_INSTALLER||!/^[a-f0-9]{64}$/.test(data.sha256))throw new Error('Invalid update file size or checksum.');
  if(typeof data.notes!=='string'||data.notes.length>4000||!Number.isFinite(Date.parse(data.publishedAt)))throw new Error('Invalid release details.');
  return data;
}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
