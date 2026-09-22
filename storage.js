// Revision comparison and write share one transaction, so two tabs cannot race.
export function localStore(){
  let dbPromise,revision=null;
  const db=()=>dbPromise??=new Promise((resolve,reject)=>{
    const r=indexedDB.open('printsmen-badge-studio',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('projects');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  async function readKey(key){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('projects').objectStore('projects').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function entries(){const d=await db();return new Promise((resolve,reject)=>{const values=[],r=d.transaction('projects').objectStore('projects').openCursor();r.onsuccess=()=>{const c=r.result;if(!c){resolve(values);return;}if(String(c.key).startsWith('design:'))values.push({id:c.key,...c.value});c.continue();};r.onerror=()=>reject(r.error);});}
  return {
    async read(){const saved=await readKey('last');revision=saved?.revision??null;return saved?.workspaceRecord?saved.project:saved;},
    async write(project){const d=await db();return new Promise((resolve,reject)=>{
      const t=d.transaction('projects','readwrite'),s=t.objectStore('projects'),r=s.get('last');let next,error;
      r.onsuccess=()=>{if((r.result?.revision??null)!==revision){error=new Error('Another tab saved changes. Save Project, then reload to continue autosaving.');t.abort();return;}next=crypto.randomUUID();s.put({workspaceRecord:true,revision:next,project},'last');};
      t.oncomplete=()=>{revision=next;resolve();};t.onerror=t.onabort=()=>reject(error||t.error||new Error('Local storage unavailable.'));
    });},
    async list(){return (await entries()).map(({id,name,updated,pages})=>({id,name,updated,pages})).sort((a,b)=>b.updated-a.updated);},
    async get(id){if(!String(id).startsWith('design:'))throw new Error('Invalid saved design.');return (await readKey(id))?.project;},
    async saveDesign(project){
      const size=JSON.stringify(project).length,d=await db();
      return new Promise((resolve,reject)=>{const t=d.transaction('projects','readwrite'),s=t.objectStore('projects'),r=s.openCursor();let count=0,total=size,error;
        r.onsuccess=()=>{const c=r.result;if(c){if(String(c.key).startsWith('design:')){count++;total+=c.value.size??JSON.stringify(c.value.project).length;}c.continue();return;}
          if(count>=12||total>120*1024*1024){error=new Error('Library limit: 12 designs / 120 MB. Download backups and remove an old copy first.');t.abort();return;}
          s.put({name:project.name,updated:Date.now(),pages:project.pages.length,size,project},'design:'+crypto.randomUUID());};
        t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(error||t.error||new Error('Library save failed.'));
      });
    },
    async remove(id){if(!String(id).startsWith('design:'))throw new Error('Invalid saved design.');const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('projects','readwrite');t.objectStore('projects').delete(id);t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(t.error);});}
  };
}
