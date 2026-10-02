import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const {version}=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
const destination=path.join(path.dirname(root.replace(/[\\/]$/,'')),`PrintsMen-Badge-Studio-Local-${version}.zip`);
if(existsSync(destination))throw new Error(`Package already exists: ${destination}`);
if(process.platform!=='win32')throw new Error('This packaging helper uses Windows .NET ZIP APIs. The editor itself runs with Node.js on other platforms.');
// Allowlist keeps browser projects, test outputs and unrelated tools out of releases.
const names=['assistant.js','assistant.css','automation-core.js','naming.js','products.html','products.js','products.css','products-core.js','product-pdf.js','Start Customised Studio.cmd','app.js','catalogue.js','core.js','render.js','files.js','fonts.js','storage.js','crop.js','export.js','print-plan.js','packing.js','photo.js','photo-editor.js','faces.js','face-worker.js','legacy-photo-framing.js','index.html','dashboard.html','dashboard.css','dashboard.js','badge.html','style.css','editor.css','server.mjs','studio-server.mjs','managed-server.mjs','start.mjs','Start Badge Studio.cmd','Uninstall Badge Studio.cmd','badge-sizes.html','package.json','README.md','FEATURE-AUDIT.md','THIRD-PARTY.md','LICENSING.md','activation.html','activation.css','activation.js','licensing','setup','scripts','tests','vendor','printsmen'];
const literal=s=>"'"+s.replaceAll("'","''")+"'";
names.push('badge-theme.css','updates.html','updates.js','updates.css','updates-client.js','updates-config.json','updates','Start Update Manager.cmd','UPDATES.md','login.html','login.js','session.js','preview-server.mjs');
const inputs=names.map(name=>{const file=path.join(root,name);if(!existsSync(file))throw new Error(`Missing release input: ${name}`);return literal(file);});
const command=`$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = ${literal(root)}
$stream = [System.IO.File]::Open(${literal(destination)}, [System.IO.FileMode]::CreateNew)
$zip = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($inputPath in @(${inputs.join(',')})) {
    $files = if ([System.IO.Directory]::Exists($inputPath)) { [System.IO.Directory]::EnumerateFiles($inputPath, '*', [System.IO.SearchOption]::AllDirectories) } else { @($inputPath) }
    foreach ($file in $files) {
      $entry = $file.Substring($root.Length).Replace('\\', '/')
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $entry, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  }
} finally { $zip.Dispose(); $stream.Dispose() }
Get-Item -LiteralPath ${literal(destination)} | Select-Object FullName,Length`;
const result=spawnSync('powershell.exe',['-NoProfile','-Command',command],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
