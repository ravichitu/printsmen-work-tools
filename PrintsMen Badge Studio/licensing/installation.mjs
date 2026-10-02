import {readFile, writeFile, realpath, lstat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID, randomBytes} from 'node:crypto';
import {PRODUCT, authorityFingerprint, createRequest, verifyLicence} from './licence.mjs';

export const MARKER = '.printsmen-installation.json';
const samePath = (a,b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
export async function checkedRoot(root) {
  if ((await lstat(root)).isSymbolicLink()) throw new Error('The installation directory cannot be a link.');
  return realpath(root);
}

export async function registerInstallation({root, store, machineHash, publicKey}) {
  root = await checkedRoot(root);
  const installation = {installationId:randomUUID(), root, machineHash, challenge:randomBytes(32).toString('hex'),
    authorityFingerprint:authorityFingerprint(publicKey), status:'installed', licence:null, installedAt:new Date().toISOString()};
  await store.change(async ledger => {
    if (ledger.current?.status === 'installed') throw new Error('An installation already exists. Use its managed uninstaller before reinstalling.');
    await writeFile(path.join(root, MARKER), JSON.stringify({schema:1, product:PRODUCT, installationId:installation.installationId}), {flag:'wx', mode:0o600});
    ledger.current = installation;
  }, {allowNew:true});
  return installation;
}

export class InstallationGate {
  constructor({root, store, machineHash, publicKey}) { Object.assign(this, {root, store, machineHash, publicKey}); }
  async identity(ledger) {
    const root = await checkedRoot(this.root);
    const markerPath = path.join(root, MARKER);
    if ((await lstat(markerPath)).isSymbolicLink()) throw new Error('Invalid installation marker.');
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    const installation = ledger.current;
    if (!installation || installation.status !== 'installed' || marker.schema !== 1 || marker.product !== PRODUCT ||
        marker.installationId !== installation.installationId || ledger.retired.some(item => item.installationId === marker.installationId)) {
      throw new Error('This installation is missing or retired. Reinstall and request a new approval.');
    }
    if (!samePath(installation.root, root)) throw new Error('This copy is not the registered installation directory.');
    if (installation.machineHash !== this.machineHash) throw new Error('This installation belongs to another Windows installation.');
    if (installation.authorityFingerprint !== authorityFingerprint(this.publicKey)) throw new Error('The installation licence authority has changed.');
    return installation;
  }
  async status() {
    try {
      const installation = await this.identity(await this.store.read());
      if (!installation.licence) return {mode:'managed', state:'pending', active:false, installationId:installation.installationId, message:'Owner approval is required for this installation.'};
      const licence = verifyLicence(installation.licence, this.publicKey, installation);
      return {mode:'managed', state:'active', active:true, installationId:installation.installationId,
        customer:licence.customer, licenceId:licence.licenceId, activatedAt:licence.issuedAt, expiresAt:licence.expiresAt||null, term:licence.term, tools:licence.tools,
        message:'Active for this installation. Internet was required for approval; periodic renewal is not required.'};
    } catch (error) {
      return {mode:'managed', state:'invalid', active:false, message:error.code === 'ENOENT' ? 'Installation data is missing. Use managed setup; do not copy application folders.' : error.message};
    }
  }
  async request() { return createRequest(await this.identity(await this.store.read())); }
  async activate(envelope) {
    await this.store.change(async ledger => {
      const installation = await this.identity(ledger);
      verifyLicence(envelope, this.publicKey, installation);
      installation.licence = envelope;
    });
    return this.status();
  }
  async retire() {
    await this.store.change(async ledger => {
      const installation = await this.identity(ledger);
      ledger.retired.push({installationId:installation.installationId, retiredAt:new Date().toISOString()});
      installation.status = 'retired';
      installation.licence = null;
    });
  }
}
