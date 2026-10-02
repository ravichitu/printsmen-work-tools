import {pageSVG,codeError} from './render.js';
import {canvasFor,loadImage,download,safeName} from './files.js';
import {printPlan} from './print-plan.js';
const pause=()=>new Promise(r=>setTimeout(r,0));
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
export function addDensity(bytes,type,dpi){
  if(type==='png'){const chunk=new Uint8Array(21),v=new DataView(chunk.buffer);v.setUint32(0,9);chunk.set([112,72,89,115],4);v.setUint32(8,Math.round(dpi/0.0254));v.setUint32(12,Math.round(dpi/0.0254));chunk[16]=1;v.setUint32(17,crc32(chunk.slice(4,17)));const out=new Uint8Array(bytes.length+21);out.set(bytes.slice(0,33));out.set(chunk,33);out.set(bytes.slice(33),54);return out;}
  const out=bytes.slice();if(out[2]===255&&out[3]===224&&String.fromCharCode(...out.slice(6,10))==='JFIF'){out[13]=1;out[14]=dpi>>8;out[15]=dpi&255;out[16]=dpi>>8;out[17]=dpi&255;}return out;
}
export async function raster(page,assets,dpi,type='png',cut=false,fonts={}){
  const c=canvasFor(page.badge.w/25.4*dpi,page.badge.h/25.4*dpi);const url=URL.createObjectURL(new Blob([pageSVG(page,assets,{cut,fonts})],{type:'image/svg+xml'}));
  try{await document.fonts.ready;const im=await loadImage(url),ctx=c.getContext('2d');if(type==='jpg'){ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);}ctx.drawImage(im,0,0,c.width,c.height);const blob=await new Promise(resolve=>c.toBlob(resolve,type==='jpg'?'image/jpeg':'image/png',.98));if(!blob)throw new Error('Image generation failed.');return addDensity(new Uint8Array(await blob.arrayBuffer()),type,dpi);}finally{URL.revokeObjectURL(url);c.width=c.height=0;}
}
export async function exportProject(p,options,progress,signal){
  const stop=()=>{if(signal.aborted)throw new Error('Export cancelled.');};
  stop();
  progress(null,'Checking dimensions and preparing output...');await pause();stop();
  const plan=options.format==='pdf'?printPlan(p,options):null;
  const pages=plan?plan.pages:options.current==null?p.pages:[p.pages[options.current]],name=safeName(p.name);
  if(options.format==='pdf'&&pages.reduce((n,p)=>n+(p.badge.w/25.4*options.dpi)*(p.badge.h/25.4*options.dpi),0)>100000000)throw new Error('This batch exceeds 100 megapixels of distinct artwork. Use fewer pages or lower DPI.');
  for(const page of pages)for(const o of page.objects)if(!o.hidden&&(o.type==='qr'||o.type==='barcode')){const error=codeError(o);if(error)throw new Error(`${page.name}: ${error}`);}
  if(options.format==='svg'){download(pageSVG(pages[0],p.assets,{cut:options.cut,fonts:p.fonts}),name+'.svg','image/svg+xml');return;}
  if(options.format!=='pdf'){progress(null,`Rendering ${options.dpi} DPI artwork and encoding ${options.format.toUpperCase()}...`);await pause();stop();const bytes=await raster(pages[0],p.assets,options.dpi,options.format,options.cut,p.fonts);stop();download(bytes,name+'.'+options.format,options.format==='jpg'?'image/jpeg':'image/png');return;}
  const sheets=plan.sheets,pdf=await PDFLib.PDFDocument.create(),images=new Map(),mm=72/25.4;
  for(let i=0;i<pages.length;i++){stop();progress(i/(pages.length+sheets.length),`Rendering badge ${i+1}/${pages.length}`);await pause();const bytes=await raster(pages[i],p.assets,options.dpi,'png',options.cut,p.fonts);images.set(i,await pdf.embedPng(bytes));}
  for(let i=0;i<sheets.length;i++){stop();const sheet=pdf.addPage([options.w*mm,options.h*mm]);for(const item of sheets[i])sheet.drawImage(images.get(item.page),{x:(item.x+(item.rotated?item.w:0))*mm,y:(options.h-item.y-item.h)*mm,width:(item.rotated?item.h:item.w)*mm,height:(item.rotated?item.w:item.h)*mm,...(item.rotated?{rotate:PDFLib.degrees(90)}:{})});progress((pages.length+i+1)/(pages.length+sheets.length),`Building sheet ${i+1}/${sheets.length}`);await pause();}
  stop();progress(null,'Finalising PDF and preparing download...');await pause();stop();const bytes=await pdf.save();stop();download(bytes,name+'.pdf','application/pdf');
}
export async function calibrationPDF(){
  const pdf=await PDFLib.PDFDocument.create(),mm=72/25.4,p=pdf.addPage([210*mm,297*mm]);
  p.drawText('PrintsMen - print at Actual Size / 100%',{x:20*mm,y:275*mm,size:16});
  p.drawText('Measure the square: exactly 100 x 100 mm. Disable Fit / Shrink.',{x:20*mm,y:264*mm,size:11});
  p.drawRectangle({x:20*mm,y:140*mm,width:100*mm,height:100*mm,borderWidth:.2*mm,borderColor:PDFLib.rgb(0,0,0)});
  for(let n=0;n<=100;n+=10){p.drawLine({start:{x:(20+n)*mm,y:140*mm},end:{x:(20+n)*mm,y:137*mm},thickness:.15*mm});p.drawText(String(n),{x:(19+n)*mm,y:133*mm,size:8});}
  p.drawText('Do a physical badge proof before a production run.',{x:20*mm,y:115*mm,size:11});
  download(await pdf.save(),'PrintsMen_100mm_Calibration.pdf','application/pdf');
}
