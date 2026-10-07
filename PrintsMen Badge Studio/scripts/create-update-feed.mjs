import {readFile,lstat,writeFile} from 'node:fs/promises';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {UPDATE_PRODUCT,MAX_INSTALLER,sha256,httpsURL,versionParts,updateConfig} from '../updates/release.mjs';

const [installer,version,url,output,...noteParts]=process.argv.slice(2);
if(!installer||!version||!url||!output)throw new Error('Usage: node scripts/create-update-feed.mjs INSTALLER VERSION HTTPS-URL OUTPUT [NOTES]');
versionParts(version);httpsURL(url);
const notes=noteParts.join(' ')||'PrintsMen application update.';
if(notes.length>4000)throw new Error('Release notes exceed 4000 characters.');
const privatePem=process.env.PRINTSMEN_UPDATE_PRIVATE_KEY_B64
  ? Buffer.from(process.env.PRINTSMEN_UPDATE_PRIVATE_KEY_B64,'base64').toString('utf8')
  : process.env.PRINTSMEN_UPDATE_PRIVATE_KEY;
if(!privatePem)throw new Error('PRINTSMEN_UPDATE_PRIVATE_KEY or PRINTSMEN_UPDATE_PRIVATE_KEY_B64 is required.');
const privateKey=createPrivateKey(privatePem);
if(privateKey.asymmetricKeyType!=='ed25519')throw new Error('The update signing key must be Ed25519.');
const config=JSON.parse(await readFile(new URL('../updates-config.json',import.meta.url),'utf8'));
updateConfig(config);
const configuredPublic=createPublicKey(config.publicKey).export({type:'spki',format:'der'});
const derivedPublic=createPublicKey(privateKey).export({type:'spki',format:'der'});
if(!configuredPublic.equals(derivedPublic))throw new Error('The CI signing key does not match updates-config.json.');
const stat=await lstat(installer);
if(!stat.isFile()||stat.size>MAX_INSTALLER)throw new Error('Invalid installer file.');
const bytes=await readFile(installer);
if(bytes[0]!==0x4d||bytes[1]!==0x5a)throw new Error('Expected a Windows executable.');
const data={schema:1,product:UPDATE_PRODUCT,channel:config.channel,version,url,bytes:bytes.length,sha256:sha256(bytes),publishedAt:new Date().toISOString(),notes};
const payload=Buffer.from(JSON.stringify(data));
const envelope={payload:payload.toString('base64url'),signature:sign(null,payload,privateKey).toString('base64url')};
await writeFile(output,JSON.stringify(envelope,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({version,url,bytes:bytes.length,sha256:data.sha256,output}));
