import {validateBadge,number} from './core.js';
// Best-short-side-fit rectangles; split every intersected free area to avoid overlaps.
export function pack(pages,w,h,margin,gap,rotate=false){
  number(w,10,1000);number(h,10,1000);number(margin,0,100);number(gap,0,100);
  const items=[];
  pages.forEach((p,page)=>{validateBadge(p.badge);number(p.copies,1,500,true);for(let n=0;n<p.copies;n++)items.push({page,w:p.badge.w,h:p.badge.h});});
  if(items.length>500)throw new Error('Limit each export to 500 badges.');
  items.sort((a,b)=>b.w*b.h-a.w*a.h||a.page-b.page);
  const sheets=[];let sheet=[],free=[{x:margin,y:margin,w:w-2*margin+gap,h:h-2*margin+gap}];
  function candidate(item){let best=null;for(const r of free)for(const turned of rotate?[false,true]:[false]){const iw=(turned?item.h:item.w)+gap,ih=(turned?item.w:item.h)+gap;if(iw<=r.w+1e-8&&ih<=r.h+1e-8){const score=Math.min(r.w-iw,r.h-ih);if(!best||score<best.score)best={x:r.x,y:r.y,w:iw,h:ih,turned,score};}}return best;}
  for(const item of items){
    let c=candidate(item);
    if(!c){if(sheet.length){sheets.push(sheet);sheet=[];}free=[{x:margin,y:margin,w:w-2*margin+gap,h:h-2*margin+gap}];c=candidate(item);}
    if(!c)throw new Error(`Page ${item.page+1} does not fit this sheet at exact size.`);
    sheet.push({page:item.page,x:c.x,y:c.y,w:c.w-gap,h:c.h-gap,rotated:c.turned});
    const next=[];
    for(const r of free){if(c.x>=r.x+r.w-1e-8||c.x+c.w<=r.x+1e-8||c.y>=r.y+r.h-1e-8||c.y+c.h<=r.y+1e-8){next.push(r);continue;}
      if(c.x>r.x)next.push({...r,w:c.x-r.x});if(c.x+c.w<r.x+r.w)next.push({...r,x:c.x+c.w,w:r.x+r.w-c.x-c.w});
      if(c.y>r.y)next.push({...r,h:c.y-r.y});if(c.y+c.h<r.y+r.h)next.push({...r,y:c.y+c.h,h:r.y+r.h-c.y-c.h});
    }
    free=next.filter((r,i)=>r.w>1e-8&&r.h>1e-8&&!next.some((s,j)=>i!==j&&r.x>=s.x-1e-8&&r.y>=s.y-1e-8&&r.x+r.w<=s.x+s.w+1e-8&&r.y+r.h<=s.y+s.h+1e-8&&(j<i||r.x!==s.x||r.y!==s.y||r.w!==s.w||r.h!==s.h)));
  }
  if(sheet.length)sheets.push(sheet);return sheets;
}
