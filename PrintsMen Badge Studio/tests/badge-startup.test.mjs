import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const html=await readFile(new URL('../badge.html',import.meta.url),'utf8');
const code=html.match(/<script id="badgeStartupGuard">([\s\S]*?)<\/script>/)[1];
function startup(protocol){
  const nodes=Object.fromEntries(['badgeStartup','badgeStartupTitle','badgeStartupMessage','badgeLaunchHelp','catalogueHome','badgeRetry'].map(id=>[id,{hidden:['badgeLaunchHelp','badgeRetry'].includes(id),textContent:'',setAttribute(name,value){this[name]=value;}}]));
  const events={},windowEvents={};let timeout,reloads=0;
  new Script(code).runInNewContext({
    document:{getElementById:id=>nodes[id],addEventListener:(name,fn)=>events[name]=fn},
    window:{addEventListener:(name,fn)=>windowEvents[name]=fn,removeEventListener:name=>delete windowEvents[name]},
    location:{protocol,reload:()=>reloads++},
    setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:id=>{if(id===1)timeout=null;}
  });
  return {nodes,events,windowEvents,get timeout(){return timeout;},get reloads(){return reloads;}};
}
test('opening badge.html directly shows launcher instructions instead of empty inert cards',()=>{
  const s=startup('file:');
  assert.equal(s.nodes.badgeLaunchHelp.hidden,false);
  assert.equal(s.nodes.catalogueHome.hidden,true);
  assert.match(s.nodes.badgeStartupMessage.textContent,/opened as a file/);
  assert.equal(s.nodes.badgeStartup.role,'alert');
  assert.equal(s.timeout,undefined);
  assert.match(html,/http:\/\/127\.0\.0\.1:4178\/login.html/);
  assert.match(html,/http:\/\/127\.0\.0\.1:4188\/login.html/);
});
test('normal startup hides its notice when catalogue initialization completes',()=>{
  const s=startup('http:');
  assert.equal(s.nodes.catalogueHome.hidden,false);
  assert.equal(s.nodes.badgeLaunchHelp.hidden,true);
  s.events['badge-studio-ready']();
  assert.equal(s.nodes.badgeStartup.hidden,true);
  assert.equal(s.timeout,null);
  assert.equal(Object.keys(s.windowEvents).length,0);
});
test('module failures display recovery instructions and a working retry action',()=>{
  const s=startup('http:');
  s.windowEvents.error();
  assert.match(s.nodes.badgeStartupMessage.textContent,/scripts could not start/);
  assert.equal(s.nodes.badgeRetry.hidden,false);
  assert.equal(s.timeout,null);
  s.nodes.badgeRetry.onclick();assert.equal(s.reloads,1);
});
test('slow startup shows a notice but can still finish successfully',()=>{
  const s=startup('http:');s.timeout();
  assert.match(s.nodes.badgeStartupMessage.textContent,/longer than expected/);
  s.events['badge-studio-ready']();assert.equal(s.nodes.badgeStartup.hidden,true);
});
