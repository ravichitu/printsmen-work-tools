import {authorityFingerprint} from './licence.mjs';

export function validateAuthority(config, {allowTestHttp = false} = {}) {
  if (!config || config.schema !== 1 || typeof config.publicKey !== 'string') throw new Error('Activation authority is not configured.');
  authorityFingerprint(config.publicKey);
  const url = new URL(config.url);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('The activation authority must be a base URL without credentials or a path.');
  const test = allowTestHttp && url.protocol === 'http:' && url.hostname === '127.0.0.1';
  if (!test && (url.protocol !== 'https:' || ['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.hostname.endsWith('.localhost'))) {
    throw new Error('Production activation requires an HTTPS online authority.');
  }
  return {...config, url:url.origin};
}

export class OnlineActivation {
  constructor({gate, config, fetcher = fetch, allowTestHttp = false}) {
    this.gate = gate;
    this.config = validateAuthority(config, {allowTestHttp});
    this.fetcher = fetcher;
  }
  async send(endpoint, data) {
    let response;
    try {
      response = await this.fetcher(this.config.url + endpoint, {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data), redirect:'error', signal:AbortSignal.timeout(12000)});
    } catch { throw new Error('Cannot reach the online activation service. Connect to the internet and try again. Existing approved installations remain valid.'); }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 16384) throw new Error('The activation response is too large.');
      chunks.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!response.ok) throw new Error(result.error || 'Online activation was refused.');
    return result;
  }
  async activate(customer, licenceKey, client) {
    if (this.busy) throw new Error('An activation check is already running.');
    this.busy = true;
    try {
      const request = await this.gate.request();
      const reply = await this.send('/v1/activation/request', {...request, customer, licenceKey, client});
      if (reply.state !== 'approved') return {state:reply.state, message:reply.message || 'Request sent. Waiting for owner approval.'};
      if (!reply.licence) throw new Error('The approval receipt is missing.');
      // Only a verified receipt from this online exchange can unlock the installation.
      const status = await this.gate.activate(reply.licence);
      if (!status.active) throw new Error(status.message);
      let confirmation = 'recorded';
      try { await this.send('/v1/activation/confirm', {...request, licenceId:status.licenceId}); }
      catch { confirmation = 'pending'; }
      return {...status, confirmation, message:status.message + (confirmation === 'pending' ? ' Dashboard confirmation could not sync. Check activation again when connected.' : '')};
    } finally { this.busy = false; }
  }
}
