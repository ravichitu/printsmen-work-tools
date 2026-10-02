import {PRESETS} from './core.js';

export const UNIT_MM=Object.freeze({mm:1,cm:10,in:25.4,inch:25.4,inches:25.4,ft:304.8,feet:304.8});
export function millimetres(value,unit='mm') {
  if(!Object.hasOwn(UNIT_MM,unit)||typeof value==='boolean'||String(value).trim()==='')throw new Error('Enter a dimension and a supported unit.');
  const n=Number(value)*UNIT_MM[unit];if(!Number.isFinite(n)||n<=0||n>1000)throw new Error('Dimensions must be greater than zero and at most 1000 mm.');
  return Math.round(n*1e6)/1e6;
}
export const TOOL_ROUTES=Object.freeze([
  ['standard','Standard Imposition','page1',/standard|visiting card|business card/i],
  ['29card','29-Card Layout','page2',/29.?card/i],['merger','A5 Merger','page3',/a5 merger/i],
  ['a4','A4 Imposition','page4',/a4 imposition/i],['polaroid','Polaroid Studio','page5',/polaroid/i],
  ['signage','Signage Studio','page6',/signage|poster|sign board/i],['booklet','Booklet Tool','page7',/booklet|compose/i],
  ['black','Black Sheet','page8',/black sheet|invert pdf/i],['custom','Custom Size','page9',/custom size|text label/i],
  ['tent','Tent Card','page10',/tent card/i],['cd','CD Label','page11',/cd label/i],['spine','Manual Spine','page13',/spine/i],
  ['enhancer','Image Enhancer','page14',/enhance|deblur|upscale|remove background/i],['uv','UV Label','page15',/uv label|uv print|spot/i],
  ['idcard','ID Card Fixer','page16',/id.?card|8050/i],['passport','Passport Photos','page17',/passport|photo sheet/i],
  ['invitation','Invitation Studio','page18',/invitation/i],['uvart','UV Artwork','page19',/uv art/i],
  ['shape','Custom Shape','page20',/custom shape/i],['numbering','Bulk Numbering','page21',/numbering|continuous number|ticket/i],
].map(([id,name,page,pattern])=>Object.freeze({id,name,page,pattern})));
const PAPER={a4:[210,297],a3:[297,420],'12x18':[304.8,457.2],'13x18':[330.2,457.2],'13x19':[330.2,482.6]};

export function planJob(text) {
  if(typeof text!=='string'||!text.trim()||text.length>2000)throw new Error('Describe a job in 1-2000 characters.');
  const q=text.toLowerCase().replaceAll('\u00d7','x'),missing=[],notes=[];
  let tool,mode=null,preset=null,size=null;
  if(/\bbox(es)?\b|packaging|sleeve/.test(q)){tool='products';mode=/sleeve/.test(q)?'sleeve':'tray';}
  else if(/dangler|hanging tag/.test(q)){tool='products';mode='dangler';}
  else if(/mock.?up|3d/.test(q)){tool='products';mode='mockup';notes.push('Mockups are presentation previews, not manufacturing measurements.');}
  else if(/badge|sticker|keychain|yoyo|paper band/.test(q))tool='badge';
  else {const matches=TOOL_ROUTES.filter(t=>t.pattern.test(q));if(matches.length===1)tool=matches[0].id;else if(matches.length>1)missing.push('Choose one tool; the request matches more than one.');}
  if(!tool)missing.push('Name the tool or product you want to create.');
  const paperPattern=/\ba[34]\b|\b(?:12\s*x\s*18|13\s*x\s*(?:18|19))(?![\d.])(?!\s*(?:mm|cm|ft|feet|x)\b)(?:\s*(?:inches|inch|in)\b)?/g;
  const paperMatch=q.match(paperPattern)||[];
  const paperKeys=[...new Set(paperMatch.map(s=>s.replace(/\s*(inches|inch|in)\b/,'').replaceAll(/\s/g,'')))];
  if(paperKeys.length>1)missing.push('Choose one output paper size.');
  const paper=paperKeys.length===1?paperKeys[0]:null;
  const dimensionText=q.replace(paperPattern,'');
  if(/-\s*\d/.test(q))missing.push('Negative dimensions or quantities are not allowed.');
  if(/\d\s*x\s*\d/.test(dimensionText)&&!/(?:mm|cm|inches|inch|in|feet|ft)\b/.test(dimensionText))missing.push('Include units for the product dimensions.');
  const dims=dimensionText.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?\s*(mm|cm|inches|inch|in|feet|ft)\b/);
  if(dims){try{size={w:millimetres(dims[1],dims[4]),h:millimetres(dims[2],dims[4]),...(dims[3]?{d:millimetres(dims[3],dims[4])}:{})};}catch(e){missing.push(e.message);}}
  const qty=q.match(/\b(\d+)\s*(?:(?:round|square|rectangle|rectangular|heart|polygon)\s+)?(?:copies|copy|badges|danglers|boxes|stickers)\b/)||q.match(/\b(?:copies|quantity|qty)\s*[:=]?\s*(\d+)\b/);
  const copies=qty?Number(qty[1]):null;
  if(copies!==null&&(!Number.isSafeInteger(copies)||copies<1||copies>500))missing.push('Copies must be a whole number from 1 to 500.');
  if(tool==='badge'){
    const diameter=dimensionText.match(/\b(\d+(?:\.\d+)?)\s*(mm|cm|inches|inch|in)\b/);
    if(/round/.test(q)&&diameter){const d=millimetres(diameter[1],diameter[2]);preset=PRESETS.find(p=>p.id.startsWith('round')&&p.faceW===d)?.id||null;}
    else if(size)preset=PRESETS.find(p=>/square/.test(q)?p.id.startsWith('square')&&p.faceW===size.w&&p.faceH===size.h:p.id.startsWith('rect')&&p.faceW===size.w&&p.faceH===size.h)?.id||null;
    if(!preset)missing.push('Choose a supported badge preset, e.g. round badge 58 mm or rectangle badge 80 x 53 mm.');
    if(preset){const p=PRESETS.find(p=>p.id===preset);notes.push(`Face ${p.faceW} x ${p.faceH} mm; cut ${p.w} x ${p.h} mm; safe ${p.safeW} x ${p.safeH} mm. These are different boundaries.`);}
    if(paper==='a3'||paper==='13x18')notes.push('Paper will use custom millimetre dimensions.');
  }
  if(tool==='products'&&mode!=='mockup'){
    if(!size)missing.push('Specify artwork dimensions with units, e.g. 80 x 120 x 30 mm for a box (width x height x depth).');
    if(size&&mode!=='dangler'&&!size.d)missing.push('Include box depth: width x height x depth, with units.');
    if(mode==='dangler'&&/round|circle/.test(q)&&size&&size.w!==size.h)missing.push('Round danglers need equal width and height.');
  }
  if(tool&&tool!=='badge'&&tool!=='products')notes.push('This tool opens in manual review mode. The assistant does not change its production dimensions or export automatically.');
  if(copies===null&&['badge','products'].includes(tool)&&mode!=='mockup')notes.push('No copy count supplied: existing manual quantity is retained.');
  const shape=/heart|love/.test(q)?'heart':/round|circle/.test(q)?'round':/polygon|hexagon/.test(q)?'polygon':'rect';
  return {schema:1,prompt:text,tool,mode,preset,size,shape,copies,paper,paperSize:paper?PAPER[paper]:null,landscape:/landscape/.test(q),missing,notes};
}
export function validatePlan(value) {
  if(value?.schema!==1||typeof value.prompt!=='string')throw new Error('Invalid job plan.');
  return planJob(value.prompt);
}
export function jobRoute(plan) {
  if(plan.tool==='badge')return 'badge.html';
  if(plan.tool==='products')return 'products.html?studio='+(plan.mode==='dangler'?'dangler':plan.mode==='mockup'?'mockup':'box');
  const tool=TOOL_ROUTES.find(t=>t.id===plan.tool);if(!tool)throw new Error('Select a tool first.');
  return 'printsmen/index.html#'+tool.page;
}
