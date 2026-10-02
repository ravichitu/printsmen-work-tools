importScripts('./vendor/pico/pico.js');
const model=fetch('./vendor/pico/facefinder.bin').then(r=>{if(!r.ok)throw new Error('Local face model is missing.');return r.arrayBuffer();}).then(b=>pico.unpack_cascade(new Int8Array(b)));
onmessage=async e=>{
  try{
    const {pixels,w,h}=e.data,classify=await model;
    const hits=pico.run_cascade({pixels,nrows:h,ncols:w,ldim:w},classify,{shiftfactor:.1,minsize:Math.max(24,Math.min(w,h)*.07),maxsize:Math.min(w,h),scalefactor:1.1});
    const faces=pico.cluster_detections(hits,.2).filter(d=>d[3]>50).slice(0,30).map(([y,x,s,score])=>({x:x-s/2,y:y-s/2,w:s,h:s,score}));
    postMessage({faces});
  }catch(e){postMessage({error:e.message});}
};
