import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {PRODUCT} from './licence.mjs';

const run = promisify(execFile);
export function defaultStateFile() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new Error('Managed licensing requires Windows and LOCALAPPDATA.');
  return path.join(process.env.LOCALAPPDATA, 'PrintsMen', 'BadgeStudioLicence', 'installation.dpapi');
}

export async function windowsMachineHash() {
  if (process.platform !== 'win32') throw new Error('Managed licensing requires Windows.');
  const {stdout} = await run('reg.exe', ['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'], {windowsHide:true, timeout:10000});
  const guid = stdout.match(/MachineGuid\s+REG_SZ\s+([0-9a-f-]{36})/i)?.[1];
  if (!guid) throw new Error('Cannot read the Windows installation identity.');
  return createHash('sha256').update(PRODUCT + ':' + guid.toLowerCase()).digest('hex');
}

// DPAPI binds saved state to the Windows account running this local server.
function dpapi(operation, input) {
  if (process.platform !== 'win32') return Promise.reject(new Error('DPAPI requires Windows.'));
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $value=[Console]::In.ReadToEnd(); $bytes=[Convert]::FromBase64String($value); $entropy=[Text.Encoding]::UTF8.GetBytes('PrintsMen-Licensing-v1'); $result=[Security.Cryptography.ProtectedData]::${operation}($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile','-NonInteractive','-Command',script], {windowsHide:true, stdio:['pipe','pipe','pipe']});
    let output = '', errors = '', settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Windows licence protection timed out.')); }, 15000);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 2e6) { child.kill(); finish(new Error('Licence state is too large.')); } });
    child.stderr.on('data', chunk => { errors += chunk; if (errors.length > 4096) errors = errors.slice(-4096); });
    child.on('error', error => finish(error));
    child.stdin.on('error', error => finish(error));
    child.on('close', code => code === 0 ? finish(null, output.trim()) : finish(new Error('Windows could not protect/read licence state for this account.')));
    child.stdin.end(input);
  });
}

export const windowsProtection = {
  async protect(text) { return dpapi('Protect', Buffer.from(text, 'utf8').toString('base64')); },
  async unprotect(cipher) { return Buffer.from(await dpapi('Unprotect', cipher), 'base64').toString('utf8'); }
};
