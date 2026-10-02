import {readdir, lstat} from 'node:fs/promises';
import path from 'node:path';

const files = ['assistant.js','assistant.css','automation-core.js','naming.js','products.html','products.js','products.css','products-core.js','product-pdf.js','Start Customised Studio.cmd',
  'app.js','catalogue.js','core.js','render.js','files.js','fonts.js','storage.js','crop.js','export.js','print-plan.js','packing.js',
  'photo.js','photo-editor.js','faces.js','face-worker.js','legacy-photo-framing.js','index.html','dashboard.html','dashboard.css','dashboard.js','badge.html','style.css','editor.css','badge-theme.css','start.mjs',
  'Start Badge Studio.cmd','badge-sizes.html','package.json','README.md','THIRD-PARTY.md','LICENSING.md',
  'studio-server.mjs','activation.html','activation.css','activation.js','Uninstall Badge Studio.cmd','login.html','login.js','session.js',
  'licensing/licence.mjs','licensing/client.mjs','licensing/catalog.mjs','licensing/windows.mjs','licensing/store.mjs','licensing/installation.mjs',
  'licensing/online.mjs','licensing/http.mjs','licensing/operator-auth.mjs','setup/managed-install.mjs','setup/apply-preview-update.mjs',
  'updates.html','updates.js','updates.css','updates-client.js','updates-config.json','updates/manager.mjs','updates/release.mjs','Start Update Manager.cmd','UPDATES.md',
  'printsmen/index.html','printsmen/printsmen-ui.js','printsmen/printsmen-ui.css','printsmen/printsmen-pdf.js'];
export async function runtimeFiles(root) {
  const result = [...files];
  async function walk(relative) {
    for (const entry of await readdir(path.join(root,relative), {withFileTypes:true})) {
      const name = relative + '/' + entry.name;
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Unexpected linked/hidden release input: '+name);
      if (entry.isDirectory()) await walk(name); else if(entry.isFile()) result.push(name);
    }
  }
  await walk('vendor');
  await walk('printsmen/printsmen-vendor/pdfjs');
  for (const name of result) if (!(await lstat(path.join(root,name))).isFile()) throw new Error('Invalid release file: '+name);
  return result;
}
