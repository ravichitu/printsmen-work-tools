export function rotateCrop(c,clockwise=true){return clockwise?{x:1-c.y-c.h,y:c.x,w:c.h,h:c.w}:{x:c.y,y:1-c.x-c.w,w:c.h,h:c.w};}
export function cropSelection(a,b,ratio=null){
  const clamp=v=>Math.max(0,Math.min(1,v));a={x:clamp(a.x),y:clamp(a.y)};b={x:clamp(b.x),y:clamp(b.y)};
  let w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
  if(ratio!=null){if(!Number.isFinite(ratio)||ratio<=0)throw new Error('Invalid crop aspect.');h=w/ratio;const maxH=b.y<a.y?a.y:1-a.y;if(h>maxH){h=maxH;w=h*ratio;}}
  if(w<.0001||h<.0001)return null;
  return {x:b.x<a.x?a.x-w:a.x,y:b.y<a.y?a.y-h:a.y,w,h};
}
