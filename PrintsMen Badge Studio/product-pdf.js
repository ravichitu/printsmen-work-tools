import {productSheet} from './products-core.js';

export function sheetSides(geometry, options, duplex=false) {
  const sheets=productSheet(geometry,options),result=[];
  for(const items of sheets){
    result.push({side:'front',items});
    if(duplex&&geometry.settings.mode==='dangler')result.push({side:'back',items:items.map(p=>({...p,x:options.w-p.x-p.w}))});
  }
  return result;
}

// Preview and export share millimetre geometry; PDF points are converted only here.
export async function productPDF(g,o,{pdfLib,rasterize,guides=true,duplex=false,signal,progress=()=>{}}) {
  const check=()=>signal?.throwIfAborted(),layout=sheetSides(g,o,duplex),pdf=await pdfLib.PDFDocument.create(),mm=72/25.4,images={};
  for(const side of new Set(layout.map(s=>s.side))){check();progress(null,`Rendering ${side} artwork at 300 DPI...`);await new Promise(resolve=>setTimeout(resolve,0));check();images[side]=await pdf.embedPng(await rasterize(side));}
  for(let i=0;i<layout.length;i++){
    check();const sheet=layout[i],page=pdf.addPage([o.w*mm,o.h*mm]);
    for(const item of sheet.items){
      page.drawImage(images[sheet.side],{x:item.x*mm,y:(o.h-item.y-g.h)*mm,width:g.w*mm,height:g.h*mm});
      if(!guides)continue;
      const lines=[...g.lines,...(g.points?g.points.map((p,j)=>({x1:p[0],y1:p[1],x2:g.points[(j+1)%g.points.length][0],y2:g.points[(j+1)%g.points.length][1],kind:'cut'})):[])];
      for(const l of lines)page.drawLine({start:{x:(item.x+l.x1)*mm,y:(o.h-item.y-l.y1)*mm},end:{x:(item.x+l.x2)*mm,y:(o.h-item.y-l.y2)*mm},thickness:.2*mm,color:l.kind==='fold'?pdfLib.rgb(0,.55,.7):pdfLib.rgb(.84,0,.44),...(l.kind==='fold'?{dashArray:[2*mm,mm]}:{})});
      if(g.hole)page.drawCircle({x:(item.x+g.hole.x)*mm,y:(o.h-item.y-g.hole.y)*mm,size:g.hole.r*mm,borderWidth:.2*mm,borderColor:pdfLib.rgb(.84,0,.44)});
    }
    progress((i+1)/layout.length,`Building sheet ${i+1} of ${layout.length} (${sheet.side})`);await new Promise(resolve=>setTimeout(resolve,0));
  }
  check();progress(null,'Finalising PDF and preparing download...');await new Promise(resolve=>setTimeout(resolve,0));check();const bytes=await pdf.save();check();return bytes;
}
