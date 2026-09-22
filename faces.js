import {loadImage} from './files.js';
export async function photoCanvas(asset,rotation=0,maxSide=1000){
  const im=await loadImage(asset.data),swap=rotation%180!==0,w=swap?asset.h:asset.w,h=swap?asset.w:asset.h,k=Math.min(1,maxSide/Math.max(w,h));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  const ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(im,-asset.w*k/2,-asset.h*k/2,asset.w*k,asset.h*k);return c;
}
export async function detectFaces(asset,rotation=0,signal){
  if(signal?.aborted)throw new Error('Face framing cancelled.');
  const c=await photoCanvas(asset,rotation,640),w=c.width,h=c.height;
  const data=c.getContext('2d').getImageData(0,0,w,h).data,pixels=new Uint8Array(w*h);
  for(let i=0;i<pixels.length;i++){const alpha=data[i*4+3]/255;pixels[i]=(2*data[i*4]+7*data[i*4+1]+data[i*4+2])/10*alpha+255*(1-alpha);}
  c.width=c.height=0;
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./face-worker.js',import.meta.url));
    const finish=(err,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();err?reject(err):resolve(value);};
    const abort=()=>finish(new Error('Face framing cancelled.'));
    const timer=setTimeout(()=>finish(new Error('Face detection timed out. Use manual framing.')),20000);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
    worker.onerror=()=>finish(new Error('Local face detector could not start. Use manual framing.'));
    worker.onmessage=e=>finish(e.data.error?new Error(e.data.error):null,e.data.faces?.map(f=>({...f,x:f.x/w,y:f.y/h,w:f.w/w,h:f.h/h})));
    worker.postMessage({pixels,w,h},[pixels.buffer]);
  });
}
