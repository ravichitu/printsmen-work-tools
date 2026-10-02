import {detectFaces} from './faces.js';

export function suggestFaceFraming(faces,sourceW,sourceH,frameW,frameH,{baseZoom=1,maxZoom=6}={}){
  if(!faces?.length||![sourceW,sourceH,frameW,frameH,baseZoom].every(n=>Number.isFinite(n)&&n>0))return null;
  const left=Math.min(...faces.map(f=>f.x)),top=Math.min(...faces.map(f=>f.y));
  const right=Math.max(...faces.map(f=>f.x+f.w)),bottom=Math.max(...faces.map(f=>f.y+f.h));
  if(![left,top,right,bottom].every(Number.isFinite)||left<0||top<0||right>1||bottom>1||right<=left||bottom<=top)return null;
  const scale=Math.max(frameW/sourceW,frameH/sourceH)*baseZoom;
  const group=faces.length>1,targetW=group?0.68:0.3,targetH=group?0.6:0.35;
  const zoom=Math.max(1,Math.min(maxZoom,Math.min(frameW*targetW/((right-left)*sourceW*scale),frameH*targetH/((bottom-top)*sourceH*scale))));
  const x=-(left+right-1)*sourceW*scale*zoom/2;
  const y=(group?0:-.12)*frameH-(top+bottom-1)*sourceH*scale*zoom/2;
  return {zoom:Math.round(zoom*100),x,y};
}

export async function detectLocalFaces(source,signal){
  if(typeof source==='string'){
    if(!/^data:image\/(png|jpeg|webp);base64,/.test(source))throw new Error('Select a local photo first.');
    const image=new Image();image.src=source;await image.decode();
    return {faces:await detectFaces({data:source,w:image.naturalWidth,h:image.naturalHeight},0,signal),w:image.naturalWidth,h:image.naturalHeight};
  }
  if(!source?.width||!source?.height||typeof source.getContext!=='function')throw new Error('Select a shape with artwork first.');
  const canvas=document.createElement('canvas'),scale=Math.min(1,640/Math.max(source.width,source.height));
  canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
  canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
  return {faces:await detectFaces({data,w:Math.round(source.width*scale),h:Math.round(source.height*scale)},0,signal),w:source.width,h:source.height};
}

