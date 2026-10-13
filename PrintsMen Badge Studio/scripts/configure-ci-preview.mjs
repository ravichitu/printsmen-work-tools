import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOperatorAuth} from '../licensing/operator-auth.mjs';

export async function configureCiPreview({root, configText}) {
  if (!configText) throw new Error('Configure the PRINTSMEN_OPERATOR_CONFIG GitHub secret with the existing operator-auth.json salted hash.');
  const config = JSON.parse(configText);
  createOperatorAuth(config);
  if (config.temporary !== true) throw new Error('Automatic preview builds require a temporary preview operator configuration.');
  const {schema, username, salt, passwordHash, temporary} = config;
  await writeFile(path.join(root, 'operator-auth.json'), JSON.stringify({schema, username, salt, passwordHash, temporary}, null, 2), {flag:'wx', mode:0o600});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await configureCiPreview({root:fileURLToPath(new URL('../', import.meta.url)), configText:process.env.PRINTSMEN_OPERATOR_CONFIG});
  console.log('Preview login configured from a salted hash. No plaintext password was stored.');
}
