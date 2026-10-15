import {createHash, randomBytes} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status)=>{throw Object.assign(new Error(message),{status});};

export function createSupabaseAuth(config,{cookieName='pm_supabase'}={}) {
  if(config?.schema!==1||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(config.publishableKey)||!/^[a-z0-9_]{1,80}$/.test(cookieName))throw new Error('Supabase sign-in configuration is invalid.');
  const sessions=new Map(),attempts=new Map();
  function tokenFrom(req){return req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
  function current(req){const token=tokenFrom(req),id=hash(token),session=sessions.get(id);if(!session||session.expires<=Date.now()){sessions.delete(id);return {id,session:null};}return {id,session};}
  return {
    status(req){const {session}=current(req);return {required:true,provider:'supabase',loggedIn:!!session,email:session?.email||null,role:session?.role||null};},
    async login(req,res,input){
      const ip=req.socket.remoteAddress,now=Date.now();
      for(const [key,value] of attempts)if(value.until<=now)attempts.delete(key);
      const attempt=attempts.get(ip)||{count:0,until:now+60000};attempts.set(ip,attempt);
      if(++attempt.count>10)fail('Too many sign-in attempts. Wait a minute and try again.',429);
      const email=typeof input?.username==='string'?input.username.trim().toLowerCase():'';
      if(!email||email.length>254||typeof input?.password!=='string'||input.password.length>256)fail('Email or password is incorrect.',401);
      let response;
      try{response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json','apikey':config.publishableKey},body:JSON.stringify({email,password:input.password}),signal:AbortSignal.timeout(12000),redirect:'error'});}catch{fail('Cannot reach Supabase. Check the internet connection and try again.',503);}
      const auth=await response.json().catch(()=>({}));
      if(!response.ok||typeof auth.access_token!=='string'||!auth.user?.id)fail('Email or password is incorrect.',401);
      let profileResponse;
      try{profileResponse=await fetch(config.url+'/rest/v1/profiles?id=eq.'+encodeURIComponent(auth.user.id)+'&select=role,account_state',{headers:{'apikey':config.publishableKey,'Authorization':'Bearer '+auth.access_token},signal:AbortSignal.timeout(12000),redirect:'error'});}catch{fail('Could not verify account access with Supabase.',503);}
      const profiles=await profileResponse.json().catch(()=>[]),profile=profiles[0];
      if(!profileResponse.ok)fail('Supabase profile setup is incomplete. Contact the owner.',503);
      if(!profile||profile.account_state!=='active'||!['owner','admin','operator'].includes(profile.role))fail('This account is awaiting owner access approval.',403);
      const lifetime=Math.min(8*60*60,Math.max(60,Number(auth.expires_in)||3600));
      if(sessions.size>=100)fail('Too many active sign-ins. Sign out elsewhere first.',429);
      const token=randomBytes(32).toString('base64url');
      sessions.set(hash(token),{email:auth.user.email||email,role:profile.role,accessToken:auth.access_token,expires:Date.now()+lifetime*1000});
      res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime}`);
      return {ok:true,email:auth.user.email||email,role:profile.role};
    },
    logout(req,res){sessions.delete(current(req).id);res.setHeader('Set-Cookie',cookieName+'=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');}
  };
}
