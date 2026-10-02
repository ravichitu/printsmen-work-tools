import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeOperatorConfig} from '../licensing/operator-auth.mjs';
const password=process.env.PRINTSMEN_INITIAL_PASSWORD;
if(!password)throw new Error('Set PRINTSMEN_INITIAL_PASSWORD for this command only. Never commit a plaintext password.');
const config=await makeOperatorConfig(process.argv[2]||'user',password);
await writeFile(fileURLToPath(new URL('../operator-auth.json',import.meta.url)),JSON.stringify(config,null,2),{flag:'wx',mode:0o600});
console.log('Initial operator sign-in configured. Only a salted password hash was saved.');
