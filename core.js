export const PRESETS = [
  ['round75','Round badge 75 mm','round',86,86,75,75,70,70],
  ['round58','Round badge 58 mm','round',70,70,58,58,54,54],
  ['round44','Round badge 44 mm','round',54,54,44,44,40,40],
  ['round32','Round badge 32 mm','round',44,44,32,32,29,29],
  ['square50','Square badge 50 mm','rect',61,61,50,50,46,46],
  ['rect68','Rectangle 68 x 24 mm','rect',78,34,68,24,60,18],
  ['rect80','Rectangle 80 x 53 mm','rect',85,70,80,53,76,49],
  ['polaroid','Polaroid 6 x 9','rect',60,90,54,86,52,84],
  ['sticker35','Round sticker 35 mm','round',35,35,35,35,33,33],
  ['sticker71','Sticker 71 x 22 mm','rect',71,22,71,22,69,20],
  ['sticker84','Sticker 84 x 29 mm','rect',84,29,84,29,82,27],
  ['key55','Keychain 55 x 25 mm','rect',55,25,55,25,53,23],
  ['key27','Keychain 27 x 40.5 mm','rect',27,40.5,27,40.5,25,38.5],
  ['yoyo18','Yoyo 18 mm','round',18,18,18,18,16,16],
  ['yoyo22','Yoyo 22 mm','round',22,22,22,22,20,20],
  ['band','Paper band 255 x 19 mm','rect',255,19,255,19,217,16]
].map(([id,name,shape,w,h,faceW,faceH,safeW,safeH])=>({id,name,shape,w,h,faceW,faceH,safeW,safeH,cornerRadius:shape==='round'||id==='band'?0:id==='square50'?5:id==='rect68'?3:2,...(id==='band'?{safeX:38,safeY:1.5}:{})}));
export const PRESET_GROUPS = [
  {name:'Round Badges',ids:['round75','round58','round44','round32']},
  {name:'Rectangle Badges',ids:['rect68','rect80']},
  {name:'Polaroids',ids:['polaroid']},
  {name:'Square Badges',ids:['square50']},
  {name:'Stickers',ids:['sticker35','sticker71','sticker84']},
  {name:'Keychains',ids:['key55','key27']},
  {name:'Yoyos',ids:['yoyo18','yoyo22']},
  {name:'Paper Bands',ids:['band']}
];
export function boundary(b,zone='safe') {
  const w=zone==='safe'?b.safeW:zone==='face'?b.faceW:b.w,h=zone==='safe'?b.safeH:zone==='face'?b.faceH:b.h;
  return {w,h,x:zone==='safe'?(b.safeX??(b.w-w)/2):(b.w-w)/2,y:zone==='safe'?(b.safeY??(b.h-h)/2):(b.h-h)/2,r:Math.min(b.cornerRadius||0,w/2,h/2)};
}
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => 'o' + crypto.randomUUID().replaceAll('-','');
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function number(value, min, max, integer=false) {
  if (String(value).trim()==='') throw new Error('Enter a number.');
  const n=Number(value);
  if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isSafeInteger(n))) throw new Error(`Enter ${integer?'a whole number':'a number'} between ${min} and ${max}.`);
  return n;
}
export function validateBadge(b) {
  for(const key of ['w','h','faceW','faceH','safeW','safeH']) number(b[key],1,1000);
  if(b.safeW>b.faceW||b.safeH>b.faceH||b.faceW>b.w||b.faceH>b.h) throw new Error('Safe zone must fit inside face size; face size must fit inside cut size.');
  if(b.shape==='round' && (b.w!==b.h||b.faceW!==b.faceH||b.safeW!==b.safeH)) throw new Error('Round badges need equal width and height at each boundary.');
  if(!['round','rect'].includes(b.shape)) throw new Error('Invalid badge shape.');
  number(b.cornerRadius??0,0,Math.min(b.w,b.h)/2);
  const s=boundary(b),f=boundary(b,'face');number(s.x,f.x,f.x+f.w-s.w);number(s.y,f.y,f.y+f.h-s.h);
  if(b.shape==='round'&&(s.x!==(b.w-b.safeW)/2||s.y!==(b.h-b.safeH)/2))throw new Error('Round guides must be concentric.');
  return b;
}
export function newPage(badge=PRESETS[1]) { return {id:uid(),name:'Badge',badge:clone(badge),bg:'#ffffff',bg2:'#e9f2fb',bgMode:'solid',bgAngle:90,copies:1,objects:[]}; }
export function newProject(){return {version:1,name:'Untitled badges',assets:{},fonts:{},pages:[newPage()]};}
export function makeObject(type,page) {
  const w=type==='text'?page.badge.safeW*.75:page.badge.safeW*.48,h=type==='text'?8:type==='curve'?20:w;
  return {id:uid(),type,name:type==='curve'?'Curved text':type, x:(page.badge.w-w)/2,y:(page.badge.h-h)/2,w,h,rotation:0,opacity:1,fill:'#163d59',fill2:'#3ca8b8',fillMode:'solid',angle:90,stroke:'#163d59',strokeWidth:0,strokeStyle:'solid',radius:0,sides:6,inner:.45,text:type==='curve'?'MADE FOR YOU':'PRINTSMEN',font:'Arial',fontSize:5,bold:true,italic:false,underline:false,strike:false,spacing:0,align:'middle',arcRadius:20,arcStart:50,arcFlip:false,shadow:false,shadowColor:'#000000',shadowBlur:1,shadowX:1,shadowY:1,shadowOpacity:.3,locked:false,hidden:false,group:null,fit:'cover',bleed:'none',brightness:100,contrast:100,saturation:100,filter:'none',crop:{x:0,y:0,w:1,h:1},cropShape:'rect',value:'PRINTSMEN-001',barcode:'CODE128',showValue:true,field:''};
}
export function corners(o) { const t=o.rotation*Math.PI/180,c=Math.cos(t),s=Math.sin(t),x=o.x+o.w/2,y=o.y+o.h/2; return [[-o.w/2,-o.h/2],[o.w/2,-o.h/2],[o.w/2,o.h/2],[-o.w/2,o.h/2]].map(([a,b])=>({x:x+a*c-b*s,y:y+a*s+b*c})); }
export function bounds(objects){const pts=objects.flatMap(corners);return {x:Math.min(...pts.map(p=>p.x)),y:Math.min(...pts.map(p=>p.y)),right:Math.max(...pts.map(p=>p.x)),bottom:Math.max(...pts.map(p=>p.y))};}
export function outside(o,b) {const a=boundary(b);return corners(o).some(p=>{if(b.shape==='round')return ((p.x-b.w/2)/(b.safeW/2))**2+((p.y-b.h/2)/(b.safeH/2))**2>1.00001;if(p.x<a.x||p.y<a.y||p.x>a.x+a.w||p.y>a.y+a.h)return true;const cx=Math.max(a.x+a.r,Math.min(p.x,a.x+a.w-a.r)),cy=Math.max(a.y+a.r,Math.min(p.y,a.y+a.h-a.r));return (p.x-cx)**2+(p.y-cy)**2>a.r*a.r+1e-8;});}
export function alignObjects(objects,b,direction){if(!objects.length)return;const a=bounds(objects),w=a.right-a.x,h=a.bottom-a.y,s=boundary(b),rx=s.x,ry=s.y;let dx=0,dy=0;if(direction.includes('left'))dx=rx-a.x;else if(direction.includes('right'))dx=rx+b.safeW-a.right;else if(direction==='center'||direction==='top'||direction==='bottom')dx=rx+s.w/2-(a.x+w/2);if(direction.includes('top'))dy=ry-a.y;else if(direction.includes('bottom'))dy=ry+b.safeH-a.bottom;else if(direction==='center'||direction==='left'||direction==='right')dy=ry+s.h/2-(a.y+h/2);objects.forEach(o=>{o.x+=dx;o.y+=dy;});}
export function copyPage(p){const c=clone(p),groups=new Map();c.id=uid();c.objects.forEach(o=>{o.id=uid();if(o.group){if(!groups.has(o.group))groups.set(o.group,uid());o.group=groups.get(o.group);}});return c;}
export function fitObjects(objects,b){if(!objects.length)return;const a=bounds(objects),s=boundary(b),inset=b.shape==='round'?Math.SQRT1_2:.92,k=Math.min(s.w*inset/(a.right-a.x),s.h*inset/(a.bottom-a.y));if(objects.some(o=>o.w*k<.1||o.h*k<.1||o.w*k>2000||o.h*k>2000))throw new Error('This selection cannot fit without making an object too small. Move objects closer together first.');objects.forEach(o=>{o.x=(o.x-a.x)*k;o.y=(o.y-a.y)*k;o.w*=k;o.h*=k;if(['text','curve'].includes(o.type)){o.fontSize=Math.max(.1,Math.min(300,o.fontSize*k));o.arcRadius=Math.max(.1,Math.min(1000,o.arcRadius*k));}});alignObjects(objects,b,'center');}
export function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,closed=false;
  const cell=()=>{row.push(value);value='';closed=false;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
    if(c===','){cell();continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;cell();rows.push(row);row=[];continue;}
    if(closed)throw new Error('Unexpected text after a CSV closing quote.');
    if(c==='"'){if(value!=='')throw new Error('Invalid CSV quoting.');quoted=true;}else value+=c;
  }
  if(quoted)throw new Error('Unclosed CSV quotation.');
  if(value!==''||row.length||closed){cell();rows.push(row);}
  const headers=(rows.shift()||[]).map(h=>h.trim());
  if(!headers.length||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new Error('CSV headers must be unique and nonempty.');
  return {headers,rows:rows.filter(r=>r.some(c=>c.trim())).map(r=>{if(r.length!==headers.length)throw new Error('CSV row has a different column count.');return Object.fromEntries(headers.map((h,i)=>[h,r[i]]));})};
}
export function impose(pages,sheetW,sheetH,margin,gap) {
  number(sheetW,10,1000);number(sheetH,10,1000);number(margin,0,100);number(gap,0,100);
  const sheets=[];let sheet=[],x=margin,y=margin,rowH=0,total=0;
  for(let pi=0;pi<pages.length;pi++){const page=pages[pi],b=page.badge;validateBadge(b);number(page.copies,1,500,true);total+=page.copies;if(total>500)throw new Error('Limit each export to 500 badges.');if(b.w>sheetW-margin*2||b.h>sheetH-margin*2)throw new Error(`Page ${pi+1} does not fit this sheet at exact size.`);
    for(let i=0;i<page.copies;i++){if(x+b.w>sheetW-margin+1e-8){x=margin;y+=rowH+gap;rowH=0;}if(y+b.h>sheetH-margin+1e-8){sheets.push(sheet);sheet=[];x=margin;y=margin;rowH=0;}sheet.push({page:pi,x,y,w:b.w,h:b.h});x+=b.w+gap;rowH=Math.max(rowH,b.h);}}
  if(sheet.length)sheets.push(sheet);return sheets;
}
