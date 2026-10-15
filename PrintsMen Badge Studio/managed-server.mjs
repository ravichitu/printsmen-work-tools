import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LicenceStore} from './licensing/store.mjs';
import {InstallationGate} from './licensing/installation.mjs';
import {windowsMachineHash, windowsProtection, defaultStateFile} from './licensing/windows.mjs';
import {OnlineActivation, validateAuthority} from './licensing/online.mjs';
import {createStudioServer,rootId} from './studio-server.mjs';
import {createOperatorAuth} from './licensing/operator-auth.mjs';
import {loadUpdateManager} from './updates/manager.mjs';
import {createSupabaseAuth} from './licensing/supabase-auth.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
let gate = null, activation = null, configurationError = '',operatorAuth=null;
try {
  const authConfig=JSON.parse(await readFile(path.join(root,'supabase/config.json'),'utf8'));
  operatorAuth=createSupabaseAuth(authConfig,{cookieName:'pm_supabase_'+rootId(root)});
  const config = validateAuthority(JSON.parse(await readFile(path.join(root, 'activation-authority.json'), 'utf8')));
  gate = new InstallationGate({root, publicKey:config.publicKey, machineHash:await windowsMachineHash(),
    store:new LicenceStore(defaultStateFile(), windowsProtection)});
  if(config.mode!=='offline')activation = new OnlineActivation({gate, config});
} catch (error) { configurationError = 'Managed activation configuration is unavailable. Contact the owner. ' + error.message; }
const updates=await loadUpdateManager(root).catch(error=>{console.error('Updates disabled: '+error.message);return null;});
const server = createStudioServer({root, gate, activation, configurationError,operatorAuth,updates});
server.listen(Number(process.env.PORT || 4178), '127.0.0.1', () => console.log('PrintsMen managed studio: http://127.0.0.1:' + server.address().port));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
