import {fileURLToPath} from 'node:url';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createStudioServer,rootId} from './studio-server.mjs';
import {createOperatorAuth} from './licensing/operator-auth.mjs';
import {loadUpdateManager} from './updates/manager.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
let operatorAuth=null,configurationError='';
try{operatorAuth=createOperatorAuth(JSON.parse(await readFile(path.join(root,'operator-auth.json'),'utf8')),{cookieName:'pm_operator_'+rootId(root)});}catch{configurationError='Preview operator sign-in is missing or corrupt. Reinstall this preview.';}
if(await access(path.join(root,'.update-pending')).then(()=>true,()=>false))configurationError='An interrupted update needs owner recovery. The rollback files are preserved in .update-pending. Do not uninstall or delete that folder.';
const updates=await loadUpdateManager(root).catch(error=>{console.error('Updates disabled: '+error.message);return null;});
const server=createStudioServer({root,operatorAuth,configurationError,edition:'preview',updates});
server.listen(Number(process.env.PORT||4188),'127.0.0.1',()=>console.log('PrintsMen LOCAL PREVIEW: http://127.0.0.1:'+server.address().port));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
