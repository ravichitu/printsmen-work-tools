export const TOOL_CATALOG = [
  {id:'badge', name:'Customised Studio', page:null},
  {id:'printsmen.standard', name:'Standard Imposition', page:'page1'},
  {id:'printsmen.hybrid', name:'13 x 19 / 29-Card', page:'page2'},
  {id:'printsmen.a5', name:'A5 Merger', page:'page3'},
  {id:'printsmen.a4', name:'A4 Imposition', page:'page4'},
  {id:'printsmen.polaroid', name:'Polaroid Studio', page:'page5'},
  {id:'printsmen.signage', name:'Signage Studio', page:'page6'},
  {id:'printsmen.compose', name:'Compose / Booklet Tool', page:'page7'},
  {id:'printsmen.black-sheet', name:'Black Sheet', page:'page8'},
  {id:'printsmen.custom-size', name:'Custom Size', page:'page9'},
  {id:'printsmen.tent', name:'Tent Card Studio', page:'page10'},
  {id:'printsmen.cd', name:'CD Label Studio', page:'page11'},
  {id:'printsmen.spine', name:'Manual Spine Strip', page:'page13'},
  {id:'printsmen.enhancer', name:'Image Enhancer', page:'page14'},
  {id:'printsmen.uv-label', name:'UV Label Output', page:'page15'},
  {id:'printsmen.id-card', name:'ID Card Fixer', page:'page16'},
  {id:'printsmen.passport', name:'Passport Photos', page:'page17'},
  {id:'printsmen.invitation', name:'Invitation Studio', page:'page18'},
  {id:'printsmen.uv-artwork', name:'UV Artwork Builder', page:'page19'},
  {id:'printsmen.shape', name:'Custom Shape Studio', page:'page20'},
  {id:'printsmen.numbering', name:'Bulk Numbering Studio', page:'page21'}
];
export function validateTools(tools) {
  if (!Array.isArray(tools) || !tools.length || tools.length > TOOL_CATALOG.length || new Set(tools).size !== tools.length ||
      tools.some(id => !TOOL_CATALOG.some(tool => tool.id === id))) throw new Error('Select at least one valid tool; duplicate or unknown tools are not allowed.');
  return TOOL_CATALOG.filter(tool => tools.includes(tool.id)).map(tool => tool.id);
}
