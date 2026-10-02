import {esc,uid} from './core.js';

export const FONT_LIMIT=10*1024*1024;
const dataPattern=/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$/;
export function validateFonts(fonts={}) {
  const result={};let bytes=0;
  for(const [family,f] of Object.entries(fonts)){
    if(!/^pmfont_[a-z0-9]+$/.test(family)||!dataPattern.test(f?.data||''))throw new Error('Invalid embedded font.');
    bytes+=f.data.length;if(bytes>FONT_LIMIT||Object.keys(result).length>=20)throw new Error('Fonts exceed 20 files / 10 MB.');
    result[family]={name:String(f.name||'Custom font').slice(0,100),data:f.data};
  }
  return result;
}
const installed=new Map();
export async function installFonts(fonts={}){
  for(const [family,font] of Object.entries(validateFonts(fonts))){
    if(installed.get(family)?.data===font.data)continue;
    const face=await new FontFace(family,`url(${font.data})`).load();
    if(installed.has(family))document.fonts.delete(installed.get(family).face);
    document.fonts.add(face);installed.set(family,{data:font.data,face});
  }
}
export async function importFont(file){
  if(file.size>4*1024*1024)throw new Error('Choose a font smaller than 4 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),sig=String.fromCharCode(...bytes.slice(0,4));
  const format=sig==='wOFF'?'woff':sig==='wOF2'?'woff2':sig==='OTTO'?'otf':bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0?'ttf':null;
  if(!format)throw new Error('Use a valid TTF, OTF, WOFF or WOFF2 font.');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {[`pmfont_${uid()}`]:{name:file.name.replace(/\.[^.]+$/,''),data:`data:font/${format};base64,${btoa(binary)}`}};
}
export function fontStyle(fonts={}){
  return `<style>${Object.entries(validateFonts(fonts)).map(([family,f])=>`@font-face{font-family:'${family}';src:url('${esc(f.data)}');}`).join('')}</style>`;
}
