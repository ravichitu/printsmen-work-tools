export function documentName(value) {
  const name=String(value||'').replace(/\s*\/\s*\d+$/,'').split(/[\\/]/).pop().replace(/\.(pdf|jpe?g|png|webp|svg|tiff?|json)$/i,'');
  let clean=name.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').trim().slice(0,80);
  if(!clean)clean='artwork';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean))clean='artwork_'+clean;
  return clean;
}
export function uploadName(files) { return documentName(files[0]?.name||'artwork')+(files.length>1?'_batch':''); }
export function outputName(name,{tool='',page=null,extension='pdf'}={}) {
  if(!/^[a-z0-9]+$/i.test(extension))throw new Error('Invalid output extension.');
  return documentName(name)+(tool?'_'+documentName(tool):'')+(page==null?'':'_page-'+String(page).padStart(3,'0'))+'.'+extension;
}
