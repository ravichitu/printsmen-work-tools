const limits={contactPerson:120,phone:40,email:254,address:600,reference:80};
export function validateClient(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid client details.');
  const client={};
  for(const [field,max] of Object.entries(limits)){
    const value=input[field]??'';
    if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw new Error('Invalid client '+field+'.');
    client[field]=value.trim();
  }
  if(client.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email))throw new Error('Enter a valid client email address.');
  if(client.phone&&!/^\+?[0-9 ().-]{5,40}$/.test(client.phone))throw new Error('Enter a valid client phone number.');
  return client;
}
const normal=value=>String(value??'').trim().replace(/\s+/g,' ').toLowerCase();
export function checkClientIdentity(key,input){
  if(normal(input.customer)!==normal(key.customer))throw new Error('Client name does not match the licence sheet.');
  const entered=validateClient(input.client||{});
  if(key.client?.email&&normal(entered.email)!==normal(key.client.email))throw new Error('Client email does not match the licence sheet.');
  const phone=value=>String(value??'').replace(/\D/g,'');
  if(key.client?.phone&&phone(entered.phone)!==phone(key.client.phone))throw new Error('Client phone does not match the licence sheet.');
  return entered;
}
