import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createStudioServer,rootId} from './studio-server.mjs';
import {readFile} from 'node:fs/promises';
import {createOperatorAuth} from './licensing/operator-auth.mjs';
import {loadUpdateManager} from './updates/manager.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
let operatorAuth=null,configurationError='';
try{operatorAuth=createOperatorAuth(JSON.parse(await readFile(path.join(root,'operator-auth.json'),'utf8')),{cookieName:'pm_operator_'+rootId(root)});}catch{configurationError='Local operator sign-in must be configured before using this copy.';}
const updates=await loadUpdateManager(root).catch(error=>{console.error('Updates disabled: '+error.message);return null;});
const server=createStudioServer({root,operatorAuth,configurationError,updates});
server.listen(Number(process.env.PORT||4178),'127.0.0.1',()=>{
  console.log('PrintsMen development copy: http://127.0.0.1:'+server.address().port);
  console.log('This source workspace is not licence-locked. Use the managed installer for activation testing.');
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
