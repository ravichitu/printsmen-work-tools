import {randomBytes, scrypt, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const hash=token=>createHash('sha256').update(token).digest('hex');

export async function makeOperatorConfig(username,password) {
  if(typeof username!=='string'||!/^[a-z0-9._-]{1,40}$/i.test(username)||typeof password!=='string'||password.length<4||password.length>256)throw new Error('Invalid initial operator credentials.');
  const salt=randomBytes(32).toString('hex');
  return {schema:1,username,salt,passwordHash:(await derive(password,salt,64)).toString('hex'),temporary:true};
}

export function createOperatorAuth(config,{cookieName='pm_operator'}={}) {
  if(!/^[a-z0-9_]{1,80}$/.test(cookieName))throw new Error('Invalid session cookie name.');
  if(config?.schema!==1||!/^[a-z0-9._-]{1,40}$/i.test(config.username)||!/^[0-9a-f]{64}$/.test(config.salt)||!/^[0-9a-f]{128}$/.test(config.passwordHash))throw new Error('Operator sign-in is not configured correctly.');
  const sessions=new Map(),attempts=new Map();
  function current(req) {
    const now=Date.now();
    for(const [key,value] of sessions)if(value.expires<now||value.absolute<now)sessions.delete(key);
    for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
    const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
    const session=sessions.get(hash(token));
    if(session)session.expires=now+30*60*1000;
    return {token,session};
  }
  return {
    status(req){return {required:true,loggedIn:!!current(req).session,username:current(req).session?config.username:null,temporary:config.temporary===true};},
    async login(req,res,input) {
      current(req);
      const ip=req.socket.remoteAddress;
      const attempt=attempts.get(ip)||{count:0,until:Date.now()+60000};
      attempts.set(ip,attempt);
      if(++attempt.count>10)throw Object.assign(new Error('Too many sign-in attempts. Wait a minute and try again.'),{status:429});
      if(typeof input.password!=='string'||input.password.length>256||typeof input.username!=='string')throw Object.assign(new Error('Username or password is incorrect.'),{status:401});
      const actual=await derive(input.password,config.salt,64),expected=Buffer.from(config.passwordHash,'hex');
      if(input.username!==config.username||!timingSafeEqual(actual,expected))throw Object.assign(new Error('Username or password is incorrect.'),{status:401});
      if(sessions.size>=100)throw Object.assign(new Error('Too many sessions. Sign out of another browser first.'),{status:429});
      const token=randomBytes(32).toString('base64url');
      sessions.set(hash(token),{expires:Date.now()+30*60*1000,absolute:Date.now()+8*60*60*1000});
      res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
      return {ok:true,username:config.username,temporary:config.temporary===true};
    },
    logout(req,res){sessions.delete(hash(current(req).token));res.setHeader('Set-Cookie',cookieName+'=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');}
  };
}
