const $ = id => document.getElementById(id);
let token = '', busy = false;
async function refresh() {
  const response = await fetch('/api/studio/status', {cache:'no-store'});
  if (!response.ok) throw new Error('Could not read installation status.');
  const data = await response.json(), licence = data.licence;
  token = data.csrf;
  $('state').textContent = {active:'Activated',pending:'Approval required',invalid:'Installation locked',development:'Development copy',preview:'Local preview'}[licence.state] || 'Unknown';
  $('state').classList.toggle('active', licence.state === 'active');
  $('message').textContent = licence.message;
  $('customer').textContent = licence.customer || 'Not approved yet';
  $('installation').textContent = licence.installationId || 'Not registered';
  $('activated').textContent = licence.activatedAt ? new Date(licence.activatedAt).toLocaleString(undefined, {dateStyle:'full',timeStyle:'long'}) : 'Not activated';
  $('utc').textContent = licence.activatedAt || 'Not activated';
  $('validity').textContent = licence.state === 'active' ? (licence.expiresAt?'Expires '+new Date(licence.expiresAt).toLocaleString():'Lifetime of this installation; no expiry') : ['development','preview'].includes(licence.mode) ? 'No production licence applied' : 'Approval required';
  $('tools').textContent = licence.state === 'active' ? data.tools.filter(tool => licence.tools.includes(tool.id)).map(tool => tool.name).join(', ') : ['development','preview'].includes(licence.mode) ? 'All tools available for local testing' : 'Locked until approved';
  $('open').hidden = !licence.active;
  $('activate').disabled = busy || !data.onlineActivation || licence.state === 'invalid';
  if (licence.customer && !$('shop').value) $('shop').value = licence.customer;
  if (!data.onlineActivation) $('result').textContent = 'Online activation is not configured in this development copy. Production setup needs the owner\'s HTTPS activation service.';
}
$('activationForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true; $('activate').disabled = true; $('result').textContent = 'Contacting the online approval service...';
  try {
    const response = await fetch('/api/licence/activate', {method:'POST', headers:{'Content-Type':'application/json','X-Studio-CSRF':token}, body:JSON.stringify({customer:$('shop').value.trim(),licenceKey:$('licenceKey').value.trim(),client:{email:$('clientEmail').value.trim(),phone:$('clientPhone').value.trim()}})});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Activation failed.');
    $('result').textContent = result.message;
  } catch (error) { $('result').textContent = error.message; }
  finally { busy = false; await refresh().catch(error => { $('message').textContent = error.message; }); }
});
refresh().catch(error => { $('message').textContent = error.message; $('state').textContent = 'Unavailable'; });
