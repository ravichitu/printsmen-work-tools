import {impose,number} from './core.js';
import {pack} from './packing.js';

export const PAPER_SIZES={a4:[210,297],'12x18':[304.8,457.2],'13x19':[330.2,482.6]};
export function sheetCapacity(b,w,h,margin,gap){
  number(w,10,1000);number(h,10,1000);number(margin,0,100);number(gap,0,100);
  return Math.max(0,Math.floor((w-2*margin+gap+1e-8)/(b.w+gap)))*Math.max(0,Math.floor((h-2*margin+gap+1e-8)/(b.h+gap)));
}
// Preview and PDF use this same plan; quantities never mutate the saved design.
export function printPlan(project,options){
  const selected=options.current==null?project.pages:[project.pages[number(options.current,0,project.pages.length-1,true)]];
  const layout=options.layout??'gangup';
  if(!['gangup','separate'].includes(layout))throw new Error('Choose a valid gang-up layout.');
  const pages=selected.map(p=>({...p,copies:number(options.quantities?.[p.id]??p.copies,0,500,true)})).filter(p=>p.copies>0);
  const total=pages.reduce((sum,p)=>sum+p.copies,0);
  if(!total)throw new Error('Enter at least one copy to export.');
  if(total>500)throw new Error('Limit each export to 500 total copies.');
  const {w,h,margin,gap}=options;
  const method=options.packing??'rows';if(!['rows','smart'].includes(method))throw new Error('Choose a valid packing method.');
  const arrange=ps=>method==='smart'?pack(ps,w,h,margin,gap,options.rotate===true):impose(ps,w,h,margin,gap);
  const sheets=layout==='gangup'?arrange(pages):pages.flatMap((p,i)=>arrange([p]).map(sheet=>sheet.map(item=>({...item,page:i}))));
  return {pages,sheets,total};
}
