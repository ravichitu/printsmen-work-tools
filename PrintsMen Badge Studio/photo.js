const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function frameCrop(iw,ih,ratio,zoom=100,px=0,py=0){
  if(![iw,ih,ratio,zoom,px,py].every(Number.isFinite)||iw<=0||ih<=0||ratio<=0||zoom<100||zoom>600)throw new Error('Invalid photo framing values.');
  const r=ratio*ih/iw,w=Math.min(1,r)*100/zoom,h=Math.min(1,1/r)*100/zoom;
  return {x:(1-w)*(clamp(px,-100,100)+100)/200,y:(1-h)*(clamp(py,-100,100)+100)/200,w,h};
}
export function framingValues(c,iw,ih,ratio){
  const base=frameCrop(iw,ih,ratio);
  return {zoom:clamp(Math.min(base.w/c.w,base.h/c.h)*100,100,600),x:c.w>=1?0:clamp(c.x/(1-c.w)*200-100,-100,100),y:c.h>=1?0:clamp(c.y/(1-c.h)*200-100,-100,100)};
}
export function faceCrop(faces,iw,ih,ratio){
  if(!faces.length)return null;
  const left=Math.min(...faces.map(f=>f.x)),top=Math.min(...faces.map(f=>f.y)),right=Math.max(...faces.map(f=>f.x+f.w)),bottom=Math.max(...faces.map(f=>f.y+f.h));
  const fw=right-left,fh=bottom-top;
  let h=fh*(faces.length===1?3:1.6),w=Math.max(fw*1.5,h*ratio);h=Math.max(h,w/ratio);w=h*ratio;
  const k=Math.min(1,iw/w,ih/h);w*=k;h*=k;
  if(w<fw||h<fh)return null;
  const cx=(left+right)/2,cy=faces.length===1?top+fh*1.15:(top+bottom)/2;
  return {x:clamp(cx-w/2,0,iw-w)/iw,y:clamp(cy-h/2,0,ih-h)/ih,w:w/iw,h:h/ih};
}
export function rotatedSize(a,rotation=0){return rotation%180?{w:a.h,h:a.w}:{w:a.w,h:a.h};}
export function scaleBorders(o,original,w,h){
  if(!original.scaleBorders)return;
  const k=Math.sqrt(w/original.w*h/original.h);
  o.strokeWidth=clamp(original.strokeWidth*k,0,20);o.radius=clamp(original.radius*k,0,1000);
}
