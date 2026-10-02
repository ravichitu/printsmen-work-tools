import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {suggestFaceFraming} from '../legacy-photo-framing.js';

test('local face framing keeps each suggestion within the photo controls',()=>{
  const centered=suggestFaceFraming([{x:.4,y:.3,w:.2,h:.25}],1000,1000,50,70);
  assert.ok(centered.zoom>=100&&centered.zoom<=600);
  assert.ok(Math.abs(centered.x)<1);
  const right=suggestFaceFraming([{x:.7,y:.3,w:.15,h:.2}],1000,1000,50,70);
  assert.ok(right.x<0);
  assert.ok(suggestFaceFraming([{x:.2,y:.25,w:.2,h:.2},{x:.65,y:.25,w:.2,h:.2}],1000,1000,50,70).zoom<600);
  assert.equal(suggestFaceFraming([],1000,1000,50,70),null);
  assert.equal(suggestFaceFraming([{x:-.1,y:.2,w:.2,h:.2}],1000,1000,50,70),null);
});

test('legacy Polaroid and Custom Shape share preview/export photo framing',()=>{
  const html=readFileSync(new URL('../printsmen/index.html',import.meta.url),'utf8');
  assert.match(html,/function p5PhotoRect\(/);
  assert.match(html,/p5PhotoRect\(p,img\.width,img\.height,iw,ih\)/);
  assert.match(html,/p5PhotoRect\(photoObj,nw,nh,imgAreaW_px,imgAreaH_px\)/);
  assert.match(html,/id="p20FaceSuggest"/);
  assert.match(html,/const photoRect=p20PhotoRect\(item,asset\.source\.width,asset\.source\.height,ratio\)/);
});
