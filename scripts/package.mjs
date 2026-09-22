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
const names=['app.js','core.js','render.js','files.js','fonts.js','storage.js','crop.js','export.js','print-plan.js','packing.js','photo.js','photo-editor.js','faces.js','face-worker.js','index.html','badge.html','style.css','editor.css','server.mjs','start.mjs','Start Badge Studio.cmd','badge-sizes.html','package.json','README.md','FEATURE-AUDIT.md','THIRD-PARTY.md','scripts','tests','vendor','printsmen'];
const literal=s=>"'"+s.replaceAll("'","''")+"'";
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
