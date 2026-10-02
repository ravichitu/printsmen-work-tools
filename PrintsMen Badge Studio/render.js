import {esc,outside,boundary} from './core.js';
import {fontStyle} from './fonts.js';
import {rotatedSize} from './photo.js';
const cache=new Map();
const tag=(name,attrs,body='')=>`<${name} ${attrs}>${body}</${name}>`;
export function outline(shape,x,y,w,h,attrs=''){return shape==='round'?`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" ${attrs}/>`:`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;}
export function badgeOutline(b,zone,attrs=''){const a=boundary(b,zone);return outline(b.shape,a.x,a.y,a.w,a.h,`${b.shape==='rect'?`rx="${a.r}" ry="${a.r}"`:''} ${attrs}`);}
export function shapePath(o){
  const w=o.w,h=o.h;
  if(o.type==='heart')return `M ${w/2},${h} C ${-w*.45},${h*.4} ${w*.05},${-h*.35} ${w/2},${h*.22} C ${w*.95},${-h*.35} ${w*1.45},${h*.4} ${w/2},${h} Z`;
  if(o.type==='line')return `M 0 ${h/2} H ${w}`;
  if(o.type==='arrow')return `M 0 ${h*.35} H ${w*.65} V 0 L ${w} ${h/2} L ${w*.65} ${h} V ${h*.65} H 0 Z`;
  const n=o.type==='triangle'?3:o.type==='diamond'?4:o.type==='hexagon'?6:o.type==='star'?o.sides*2:o.sides;
  return Array.from({length:n},(_,i)=>{const a=-Math.PI/2+Math.PI*2*i/n,r=o.type==='star'&&i%2?o.inner:1;return `${i?'L':'M'} ${w/2+Math.cos(a)*w/2*r} ${h/2+Math.sin(a)*h/2*r}`;}).join(' ')+' Z';
}
function machineCode(o){
  const key=JSON.stringify([o.type,o.value,o.barcode,o.fill,o.showValue]);if(cache.has(key))return cache.get(key);
  let body='';
  if(o.type==='qr'){
    const qr=window.qrcode(0,'M');qr.addData(o.value,'Byte');qr.make();const n=qr.getModuleCount();let d='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))d+=`M${x+4} ${y+4}h1v1h-1z`;
    body=`<svg viewBox="0 0 ${n+8} ${n+8}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="white"/><path d="${d}" fill="${esc(o.fill)}"/></svg>`;
  }else{
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');window.JsBarcode(svg,o.value,{format:o.barcode,displayValue:o.showValue,width:2,height:65,margin:12,fontSize:18,lineColor:o.fill,background:'#ffffff'});
    svg.setAttribute('viewBox',`0 0 ${parseFloat(svg.getAttribute('width'))} ${parseFloat(svg.getAttribute('height'))}`);svg.removeAttribute('width');svg.removeAttribute('height');body=new XMLSerializer().serializeToString(svg);
  }
  if(cache.size>200)cache.clear();cache.set(key,body);return body;
}
export function codeError(o){try{machineCode(o);return '';}catch(e){return `Invalid ${o.type==='qr'?'QR payload':o.barcode+' value'}.`;}}
export function imageMarkup(o,asset){
  if(!asset)return '';
  const rotation=o.photoRotation||0,a=rotatedSize(asset,rotation),c=o.crop||{x:0,y:0,w:1,h:1},cw=a.w*c.w,ch=a.h*c.h;
  const par=o.fit==='stretch'?'none':o.fit==='contain'?'xMidYMid meet':'xMidYMid slice';
  const filters={none:'',grayscale:'grayscale(1)',sepia:'sepia(1)',invert:'invert(1)'};
  return `<svg width="${o.w}" height="${o.h}" viewBox="${a.w*c.x} ${a.h*c.y} ${cw} ${ch}" preserveAspectRatio="${par}" overflow="hidden"><g transform="translate(${a.w/2} ${a.h/2}) rotate(${rotation}) translate(${-asset.w/2} ${-asset.h/2})"><image width="${asset.w}" height="${asset.h}" href="${esc(asset.data)}" style="filter:brightness(${o.brightness/100}) contrast(${o.contrast/100}) saturate(${o.saturation/100}) ${filters[o.filter]||''}"/></g></svg>`;
}
export function objectMarkup(o,assets){
  const id='d'+o.id,rot=`translate(${o.x} ${o.y}) rotate(${o.rotation} ${o.w/2} ${o.h/2})`;
  let defs='';let fill=esc(o.fill);
  if(o.fillMode!=='solid'){const radians=o.angle*Math.PI/180;defs+=o.fillMode==='radial'?`<radialGradient id="${id}g"><stop stop-color="${esc(o.fill)}"/><stop offset="1" stop-color="${esc(o.fill2)}"/></radialGradient>`:`<linearGradient id="${id}g" x1="${50-Math.cos(radians)*50}%" y1="${50-Math.sin(radians)*50}%" x2="${50+Math.cos(radians)*50}%" y2="${50+Math.sin(radians)*50}%"><stop stop-color="${esc(o.fill)}"/><stop offset="1" stop-color="${esc(o.fill2)}"/></linearGradient>`;fill=`url(#${id}g)`;}
  if(o.shadow)defs+=`<filter id="${id}s" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="${o.shadowX}" dy="${o.shadowY}" stdDeviation="${o.shadowBlur}" flood-color="${esc(o.shadowColor)}" flood-opacity="${o.shadowOpacity}"/></filter>`;
  const dash=o.strokeStyle==='dashed'?`${o.strokeWidth*4} ${o.strokeWidth*3}`:o.strokeStyle==='dotted'?`${o.strokeWidth*.2} ${o.strokeWidth*2}`:'';
  const style=`fill="${o.type==='line'?'none':fill}" stroke="${esc(o.stroke)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.strokeOpacity??1}" fill-opacity="${o.fillOpacity??1}" stroke-dasharray="${dash}" stroke-linejoin="round" ${o.strokeStyle==='dotted'?'stroke-linecap="round"':''}`;
  let body='';
  if(o.type==='text'||o.type==='curve'){
    const attrs=`${style} font-family="${esc(o.font)}" font-size="${o.fontSize}" font-weight="${o.bold?'700':'400'}" font-style="${o.italic?'italic':'normal'}" letter-spacing="${o.spacing}" text-decoration="${o.underline?'underline ':''}${o.strike?'line-through':''}"`;
    if(o.type==='curve'){const r=o.arcRadius,y=o.h/2,sweep=o.arcFlip?0:1;defs+=`<path id="${id}arc" d="M ${o.w/2-r} ${y} A ${r} ${r} 0 1 ${sweep} ${o.w/2+r} ${y}"/>`;body=`<text ${attrs} text-anchor="middle"><textPath href="#${id}arc" startOffset="${o.arcStart}%">${esc(o.text)}</textPath></text>`;}
    else{const lines=o.text.split('\n'),dy=o.fontSize*1.2,start=o.h/2-(lines.length-1)*dy/2;body=`<text ${attrs} text-anchor="${o.align}" dominant-baseline="central">${lines.map((l,i)=>`<tspan x="${o.align==='start'?0:o.align==='end'?o.w:o.w/2}" y="${start+i*dy}">${esc(l)||' '}</tspan>`).join('')}</text>`;}
  }else if(o.type==='image'){
    defs+=`<clipPath id="${id}clip">${outline(o.cropShape==='round'?'round':'rect',0,0,o.w,o.h)}</clipPath>`;
    body=`<g clip-path="url(#${id}clip)">${imageMarkup(o,assets[o.asset])}</g>`+outline(o.cropShape==='round'?'round':'rect',0,0,o.w,o.h,`fill="none" stroke="${esc(o.stroke)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.strokeOpacity??1}" stroke-dasharray="${dash}"`);
  }else if(o.type==='qr'||o.type==='barcode'){
    try{const caption=o.type==='qr'&&o.qrCaption,fs=Math.min(3,o.h*.1,o.w/Math.max(1,o.value.length)*1.5),codeH=caption?o.h-fs*1.8:o.h;body=`<svg width="${o.w}" height="${codeH}">${machineCode(o)}</svg>`+(caption?`<text x="${o.w/2}" y="${o.h-fs*.3}" text-anchor="middle" font-family="Arial" font-size="${fs}" fill="${esc(o.fill)}">${esc(o.value)}</text>`:'');}catch{body=`<rect width="${o.w}" height="${o.h}" fill="#ffe4e4"/><text x="1" y="${o.h/2}" font-size="3" fill="#ab1616">Invalid code value</text>`;}
  }else if(o.type==='rect')body=`<rect width="${o.w}" height="${o.h}" rx="${Math.min(o.radius,o.w/2,o.h/2)}" ${style}/>`;
  else if(o.type==='circle')body=outline('round',0,0,o.w,o.h,style);
  else body=`<path d="${shapePath(o)}" ${style}/>`;
  return `<g data-object="${o.id}" transform="${rot}" opacity="${o.opacity}" ${o.hidden?'display="none"':''}><defs>${defs}</defs><g ${o.shadow?`filter="url(#${id}s)"`:''}>${body}</g></g>`;
}
function bleedMarkup(o,assets,b){if(o.type!=='image'||o.hidden||o.bleed==='none'||!assets[o.asset])return '';
  const image=imageMarkup({...o,w:b.w,h:b.h,fit:'cover'},assets[o.asset]);
  const mask=`m${o.id}`,fx=`blur${o.id}`;const bx=(b.w-b.faceW)/2,by=(b.h-b.faceH)/2;
  const maskDef=`<mask id="${mask}"><rect width="${b.w}" height="${b.h}" fill="white"/>${badgeOutline(b,'face','fill="black"')}</mask>`;
  let bg=image;
  if(o.bleed==='blur') bg=`<defs><filter id="${fx}"><feGaussianBlur stdDeviation="2"/></filter></defs><g filter="url(#${fx})">${image}</g>`;
  if(o.bleed==='spin')bg=[0,90,180,270].map((a,i)=>`<svg x="${i%2?b.w/2:0}" y="${i>1?b.h/2:0}" width="${b.w/2}" height="${b.h/2}" viewBox="${i%2?b.w/2:0} ${i>1?b.h/2:0} ${b.w/2} ${b.h/2}"><g transform="rotate(${a} ${b.w/2} ${b.h/2})">${image}</g></svg>`).join('');
  if(o.bleed==='stretch'){
    const a=assets[o.asset],c=o.crop,iw=a.w,ih=a.h;
    const strip=(x,y,w,h,sx,sy,sw,sh)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none"><image href="${esc(a.data)}" width="${iw}" height="${ih}"/></svg>`;
    bg=strip(0,0,b.w,by,iw*c.x,ih*c.y,iw*c.w,Math.max(1,ih*.01))+strip(0,b.h-by,b.w,by,iw*c.x,ih*(c.y+c.h)-1,iw*c.w,1)+strip(0,0,bx,b.h,iw*c.x,ih*c.y,1,ih*c.h)+strip(b.w-bx,0,bx,b.h,iw*(c.x+c.w)-1,ih*c.y,1,ih*c.h);
  }
  return `<defs>${maskDef}</defs><g mask="url(#${mask})" opacity="${o.opacity}">${bg}</g>`;
}
export function pageSVG(page,assets,{guides=false,grid=false,top=false,cut=false,selection=[],overlay=false,transparent=false,fonts={}}={}){
  const b=page.badge;const clip='pageclip'+page.id;
  const bg=page.bgMode==='transparent'||transparent?'none':page.bgMode==='solid'?esc(page.bg):`url(#bg${page.id})`;
  let defs=`<clipPath id="${clip}">${badgeOutline(b,'cut')}</clipPath><linearGradient id="bg${page.id}" gradientTransform="rotate(${page.bgAngle} .5 .5)"><stop stop-color="${esc(page.bg)}"/><stop offset="1" stop-color="${esc(page.bg2)}"/></linearGradient>`;
  let body=badgeOutline(b,'cut',`fill="${bg}"`);
  body+=`<g clip-path="url(#${clip})">${page.objects.map(o=>bleedMarkup(o,assets,b)).join('')}${page.objects.map(o=>objectMarkup(o,assets)).join('')}</g>`;
  if(grid){let d='';for(let x=10;x<b.w;x+=10)d+=`M${x} 0V${b.h}`;for(let y=10;y<b.h;y+=10)d+=`M0 ${y}H${b.w}`;body+=`<path d="${d}" stroke="#7895a1" stroke-opacity=".25" stroke-width=".1" fill="none" pointer-events="none"/>`;}
  if(guides){const gs=`fill="none" stroke-width=".15" stroke-dasharray=".6 .45" pointer-events="none"`;body+=badgeOutline(b,'face',gs+' data-guide="face" stroke="#c5793b"')+badgeOutline(b,'safe',gs+' data-guide="safe" stroke="#178376"');}
  if(guides||cut)body+=badgeOutline(b,'cut','data-guide="cut" fill="none" stroke="#33465a" stroke-width=".15" pointer-events="none"');
  if(top)body+=`<text x="${b.w/2}" y="2.2" font-family="Arial" font-size="1.6" text-anchor="middle" fill="#64748b" pointer-events="none">TOP</text>`;
  if(overlay){const picked=page.objects.filter(o=>selection.includes(o.id));body+=picked.map(o=>`<g transform="translate(${o.x} ${o.y}) rotate(${o.rotation} ${o.w/2} ${o.h/2})"><rect x="0" y="0" width="${o.w}" height="${o.h}" fill="none" stroke="${o.locked?'#9ca3af':'#216afa'}" stroke-width=".22" stroke-dasharray=".8 .4" pointer-events="none"/>${picked.length===1&&!o.locked?`<line x1="${o.w/2}" y1="0" x2="${o.w/2}" y2="-3" stroke="#216afa" stroke-width=".2"/><circle data-handle="rotate" cx="${o.w/2}" cy="-3" r="1" fill="white" stroke="#216afa" stroke-width=".25"/>${[[o.w,o.h,'se'],[o.w,o.h/2,'e'],[o.w/2,o.h,'s']].map(([x,y,k])=>`<rect data-handle="${k}" x="${x-.65}" y="${y-.65}" width="1.3" height="1.3" fill="white" stroke="#216afa" stroke-width=".22"/>`).join('')}`:''}</g>`).join('');}
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${b.w}mm" height="${b.h}mm" viewBox="0 0 ${b.w} ${b.h}"><defs>${overlay?'':fontStyle(fonts)}${defs}</defs>${body}</svg>`;
}
let measureContext;
export function textExtent(o){
  if(typeof document==='undefined')return null;
  const ctx=measureContext??=document.createElement('canvas').getContext('2d');
  ctx.font=`${o.italic?'italic ':''}${o.bold?'700':'400'} 100px "${o.font.replace(/["\\]/g,'')}"`;
  const lines=o.text.split('\n'),width=Math.max(...lines.map(s=>ctx.measureText(s).width*o.fontSize/100+Math.max(0,[...s].length-1)*o.spacing),0);
  return {w:width,h:o.fontSize*(1.1+1.2*(lines.length-1))};
}
export function preflight(page,assets){const notes=[];for(const o of page.objects){
  if(o.hidden)continue;
  if(outside(o,page.badge))notes.push(`${o.name}: outside the safe zone (check intentionally bleeding artwork).`);
  if(['text','curve'].includes(o.type)){
    const size=textExtent(o);
    if(size&&o.type==='text'&&(size.w>o.w+.1||size.h>o.h+.1))notes.push(`${o.name}: text extends beyond its box. Enlarge the box or reduce font size.`);
    if(size&&o.type==='curve'&&(o.text.includes('\n')||size.w>Math.PI*o.arcRadius*2*Math.min(o.arcStart,100-o.arcStart)/100))notes.push(`${o.name}: curved text may be clipped at the arc ends.`);
  }
  if(o.type==='image'){const asset=assets[o.asset],a=asset&&rotatedSize(asset,o.photoRotation||0);if(a){const ppi=Math.min(a.w*o.crop.w/o.w,a.h*o.crop.h/o.h)*25.4;if(ppi<300)notes.push(`${o.name}: effective resolution ${Math.round(ppi)} PPI${ppi<200?' (low)':''}; changing export DPI does not add detail.`);}}
  if(o.type==='qr'||o.type==='barcode'){
    const e=codeError(o);if(e){notes.push(e);continue;}
    const rgb=[1,3,5].map(i=>parseInt(o.fill.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),contrast=1.05/(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722+.05);
    if(contrast<4.5||o.opacity<1||o.shadow)notes.push(`${o.name}: use a dark, opaque code without a shadow and scanner-test the print.`);
    if(o.type==='qr'){const qr=window.qrcode(0,'M');qr.addData(o.value,'Byte');qr.make();const fs=o.qrCaption?Math.min(3,o.h*.1,o.w/Math.max(1,o.value.length)*1.5):0;if(Math.min(o.w,o.h-fs*1.8)/(qr.getModuleCount()+8)<.25)notes.push(`${o.name}: QR modules are below 0.25 mm; enlarge and scanner-test.`);if(o.qrCaption&&fs<1)notes.push(`${o.name}: QR caption is below 1 mm; enlarge the code or shorten the value.`);}
  }
}return notes;}
