import {number,esc} from './core.js';
import {millimetres} from './automation-core.js';
import {pack} from './packing.js';

export function productSettings(input) {
  const mode=input.mode;if(!['tray','sleeve','dangler'].includes(mode))throw new Error('Choose an available product template.');
  const w=millimetres(input.w,input.unit),h=millimetres(input.h,input.unit),d=mode==='dangler'?0:millimetres(input.d,input.unit);
  const bleed=number(input.bleed,0,10),safe=number(input.safe,0,30),tab=mode==='dangler'?0:number(input.tab,1,Math.min(d||30,30));
  const shape=input.shape||'rect';if(!['rect','round','heart','polygon'].includes(shape))throw new Error('Invalid dangler shape.');
  if(mode==='dangler'&&shape==='round'&&w!==h)throw new Error('Round danglers require equal width and height.');
  if(safe*2>=Math.min(w,h))throw new Error('Safe inset is too large for this design.');
  return {mode,w,h,d,bleed,safe,tab,shape,sides:number(input.sides??6,3,16,true),hole:mode==='dangler'?number(input.hole??3,0,20):0,holeY:mode==='dangler'?number(input.holeY??8,0,h):0};
}
function line(a,b,kind){return {x1:a[0],y1:a[1],x2:b[0],y2:b[1],kind};}
const precise=n=>Math.round(n*1e6)/1e6;
function key(a,b){return [a.map(precise).join(','),b.map(precise).join(',')].sort().join(':');}
function faceEdges(faces,foldPairs){
  const xs=[...new Set(faces.flatMap(f=>[precise(f.x),precise(f.x+f.w)]))].sort((a,b)=>a-b),ys=[...new Set(faces.flatMap(f=>[precise(f.y),precise(f.y+f.h)]))].sort((a,b)=>a-b),edges=new Map();
  function add(a,b,id){const k=key(a,b);if(!edges.has(k))edges.set(k,{a,b,faces:[]});edges.get(k).faces.push(id);}
  for(const f of faces){const xx=xs.filter(x=>x>=precise(f.x)&&x<=precise(f.x+f.w)),yy=ys.filter(y=>y>=precise(f.y)&&y<=precise(f.y+f.h));for(let i=1;i<xx.length;i++){add([xx[i-1],f.y],[xx[i],f.y],f.id);add([xx[i-1],f.y+f.h],[xx[i],f.y+f.h],f.id);}for(let i=1;i<yy.length;i++){add([f.x,yy[i-1]],[f.x,yy[i]],f.id);add([f.x+f.w,yy[i-1]],[f.x+f.w,yy[i]],f.id);}}
  return [...edges.values()].map(e=>line(e.a,e.b,e.faces.length===2&&foldPairs.has(e.faces.sort().join(':'))?'fold':'cut'));
}
export function shapePoints(shape,w,h,sides=6){
  if(shape==='rect')return [[0,0],[w,0],[w,h],[0,h]];
  const count=shape==='polygon'?sides:96,points=[];
  for(let i=0;i<count;i++){const a=2*Math.PI*i/count-Math.PI/2;if(shape==='heart'){const t=2*Math.PI*i/count,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);points.push([(x+16)/32*w,(12-y)/29*h]);}else points.push([w/2+Math.cos(a)*w/2,h/2+Math.sin(a)*h/2]);}
  if(shape==='heart'||shape==='polygon'){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return points.map(([x,y])=>[(x-x0)/(x1-x0)*w,(y-y0)/(y1-y0)*h]);}
  return points;
}
function pointInside([x,y],points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],k=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-k*dx,p[1]-a[1]-k*dy);}
export function productGeometry(settings){
  const s=productSettings({...settings,unit:'mm'}),{w,h,d,tab:t,bleed:b}=s;
  if(s.mode==='dangler'){
    if(w+2*b>1000||h+2*b>1000)throw new Error('The template including outer allowance exceeds 1000 mm.');
    const points=shapePoints(s.shape,w,h,s.sides),centre=[w/2,s.holeY];
    if(s.hole>0&&(!pointInside(centre,points)||points.some((p,i)=>segmentDistance(centre,p,points[(i+1)%points.length])<s.hole/2+.5)))throw new Error('Hanging hole needs at least 0.5 mm material around it. Move it farther inside the shape or reduce its size.');
    return {settings:s,w:w+2*b,h:h+2*b,faces:[{id:'front',label:'Front',x:b,y:b,w,h}],points:points.map(([x,y])=>[x+b,y+b]),lines:[],hole:s.hole?{x:b+w/2,y:b+s.holeY,r:s.hole/2}:null};
  }
  let faces,foldPairs;
  if(s.mode==='sleeve'){
    faces=[{id:'front',label:'Front',x:b,y:b,w,h},{id:'side1',label:'Side',x:b+w,y:b,w:d,h},{id:'back',label:'Back',x:b+w+d,y:b,w,h},{id:'side2',label:'Side',x:b+2*w+d,y:b,w:d,h},{id:'glue',label:'Glue',x:b+2*w+2*d,y:b,w:t,h}];
    foldPairs=new Set(['front:side1','back:side1','back:side2','glue:side2']);
  }else{
    faces=[{id:'base',label:'Base',x:b+d,y:b+d,w,h},{id:'top',label:'Top wall',x:b+d,y:b,w,h:d},{id:'bottom',label:'Bottom wall',x:b+d,y:b+d+h,w,h:d},{id:'left',label:'Left wall',x:b,y:b+d,w:d,h},{id:'right',label:'Right wall',x:b+d+w,y:b+d,w:d,h},
      {id:'tab1',label:'Glue',x:b+d-t,y:b,w:t,h:d},{id:'tab2',label:'Glue',x:b+d+w,y:b,w:t,h:d},{id:'tab3',label:'Glue',x:b+d-t,y:b+d+h,w:t,h:d},{id:'tab4',label:'Glue',x:b+d+w,y:b+d+h,w:t,h:d}];
    foldPairs=new Set(['base:top','base:bottom','base:left','base:right','tab1:top','tab2:top','bottom:tab3','bottom:tab4']);
  }
  const totalW=Math.max(...faces.map(f=>f.x+f.w))+b,totalH=Math.max(...faces.map(f=>f.y+f.h))+b;
  if(totalW>1000||totalH>1000)throw new Error('The unfolded template exceeds 1000 mm. Reduce the finished dimensions.');
  return {settings:s,w:totalW,h:totalH,faces,lines:faceEdges(faces,foldPairs),hole:null};
}
export function artworkPlacement(face,asset,{fit='cover',zoom=1,x=0,y=0}={}){
  number(zoom,1,5);number(x,-1,1);number(y,-1,1);
  if(!['cover','contain','stretch'].includes(fit))throw new Error('Choose a valid photo fit.');
  const k=(fit==='contain'?Math.min:Math.max)(face.w/asset.w,face.h/asset.h)*zoom;
  const w=fit==='stretch'?face.w*zoom:asset.w*k,h=fit==='stretch'?face.h*zoom:asset.h*k;
  return {x:face.x+(face.w-w)/2+x*Math.abs(face.w-w)/2,y:face.y+(face.h-h)/2+y*Math.abs(face.h-h)/2,w,h,dpi:Math.min(asset.w/w,asset.h/h)*25.4};
}
const pathPoints=pts=>'M'+pts.map(p=>p.join(' ')).join(' L')+' Z';
export function productSVG(g,{art={},background='#ffffff',guides=true,labels=false,safeGuides=false,side='front'}={}){
  if(!/^#[a-f0-9]{6}$/i.test(background))throw new Error('Invalid background colour.');
  const defs=[],content=[];
  g.faces.forEach((f,i)=>{const clip=g.points?`<path d="${pathPoints(g.points)}"/>`:`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/>`;defs.push(`<clipPath id="f${i}">${clip}</clipPath>`);content.push(`<g clip-path="url(#f${i})"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${background}"/>`);const a=art[g.points&&side==='back'?'back':f.id];if(a){if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.data))throw new Error('Only local raster artwork is supported.');const p=artworkPlacement(f,a,a);content.push(`<image href="${a.data}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" preserveAspectRatio="none"/>`);}content.push('</g>');if(safeGuides&&g.settings.safe&&f.w>2*g.settings.safe&&f.h>2*g.settings.safe){const s=g.settings.safe;content.push(`<g clip-path="url(#f${i})" fill="none" stroke="#236d36" stroke-width=".2" stroke-dasharray="1 1">${g.points?`<path d="${pathPoints(g.points.map(([x,y])=>[f.x+s+(x-f.x)*(f.w-2*s)/f.w,f.y+s+(y-f.y)*(f.h-2*s)/f.h]))}"/>`:`<rect x="${f.x+s}" y="${f.y+s}" width="${f.w-2*s}" height="${f.h-2*s}"/>`}</g>`);}if(labels)content.push(`<text x="${f.x+f.w/2}" y="${f.y+f.h/2}" text-anchor="middle" fill="#555" font-size="3" font-family="Arial">${esc(g.points&&side==='back'?'Back':f.label)}</text>`);});
  if(guides){if(g.points)content.push(`<path d="${pathPoints(g.points)}" fill="none" stroke="#d60070" stroke-width=".2"/>`);for(const l of g.lines)content.push(`<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${l.kind==='fold'?'#008cb3':'#d60070'}" stroke-width=".2" ${l.kind==='fold'?'stroke-dasharray="2 1"':''}/>`);if(g.hole)content.push(`<circle cx="${g.hole.x}" cy="${g.hole.y}" r="${g.hole.r}" fill="none" stroke="#d60070" stroke-width=".2"/>`);}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.w}mm" height="${g.h}mm" viewBox="0 0 ${g.w} ${g.h}"><defs>${defs.join('')}</defs><rect width="${g.w}" height="${g.h}" fill="${background}"/>${content.join('')}</svg>`;
}
export function productSheet(g,options){
  const badge={w:g.w,h:g.h,faceW:g.w,faceH:g.h,safeW:g.w,safeH:g.h,shape:'rect',cornerRadius:0};
  return pack([{badge,copies:number(options.copies,1,500,true)}],number(options.w,10,1000),number(options.h,10,1000),number(options.margin,0,100),number(options.gap,0,100),false);
}

export function productProject(raw,limits) {
  if(raw?.schema!==1||raw.type!=='printsmen-product'||!Array.isArray(raw.assets)||raw.assets.length>20)throw new Error('Invalid product project.');
  const settings=productSettings({...raw.settings,unit:'mm'});productGeometry(settings);
  if(!/^#[a-f0-9]{6}$/i.test(raw.background))throw new Error('Invalid background.');
  let bytes=0,pixels=0;const ids=new Set();
  const assets=raw.assets.map(a=>{
    if(typeof a.id!=='string'||a.id.length>100||ids.has(a.id)||typeof a.data!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.data))throw new Error('Invalid asset.');
    ids.add(a.id);const w=number(a.w,1,16000,true),h=number(a.h,1,16000,true);
    if(w*h>limits.pixels)throw new Error('Asset too large.');bytes+=a.data.length;pixels+=w*h;
    return {id:a.id,w,h,data:a.data,name:String(a.name||'artwork').slice(0,120)};
  });
  if(bytes>limits.assets||pixels>limits.importPixels)throw new Error('Project image budget exceeded.');
  const faceIds=['front','back','base','top','bottom','left','right','side1','side2'];
  const art=Object.fromEntries(Object.entries(raw.art||{}).map(([id,a])=>{
    if(!faceIds.includes(id)||!a||!ids.has(a.assetId))throw new Error('Invalid panel artwork.');
    artworkPlacement({x:0,y:0,w:10,h:10},assets.find(item=>item.id===a.assetId),a);
    return [id,{assetId:a.assetId,fit:a.fit||'cover',zoom:number(a.zoom??1,1,5),x:number(a.x??0,-1,1),y:number(a.y??0,-1,1)}];
  }));
  const p=raw.paper||{},w=number(p.paperW??p.w??210,10,1000),h=number(p.paperH??p.h??297,10,1000);
  const paper={paper:'custom',orientation:w>h?'landscape':'portrait',paperW:w,paperH:h,productCopies:number(p.productCopies??p.copies??1,1,500,true),productMargin:number(p.productMargin??p.margin??5,0,100),productGap:number(p.productGap??p.gap??4,0,100),previewSide:p.previewSide==='back'?'back':'front',duplex:p.duplex===true||raw.duplex===true,printGuides:p.printGuides!==false};
  return {schema:1,type:'printsmen-product',name:String(raw.name||'artwork').slice(0,80),autoName:false,settings,background:raw.background,assets,art,paper};
}
