import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {runtimeFiles} from './release-files.mjs';
import {updateConfig} from '../updates/release.mjs';
import {createOperatorAuth} from '../licensing/operator-auth.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['vendor', 'printsmen-vendor', 'node_modules', 'output', 'test-output', 'dist', 'Backups']);
const failures = [];
const syntaxJobs = [];
const run = promisify(execFile);
const started = Date.now();
async function checkSyntax(file, input, module = false) {
  const args = input === undefined ? ['--check', file] : ['--check', '--input-type=' + (module ? 'module' : 'commonjs')];
  try {
    if (input === undefined) await run(process.execPath, args, {encoding:'utf8', windowsHide:true});
    else await new Promise((resolve, reject) => {
      const child = execFile(process.execPath, args, {encoding:'utf8', windowsHide:true}, error => error ? reject(error) : resolve());
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    });
  } catch (error) { failures.push(file + ': ' + (error.stderr?.trim() || error.message)); }
}
async function scan(dir) {
  let scripts = 0;
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || excluded.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scripts += await scan(file);
    else if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) { syntaxJobs.push([file]); scripts++; }
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (!match[2].trim() || /\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(match[1])) continue;
        syntaxJobs.push([file + ' (inline script)', match[2], /\btype\s*=\s*["']module["']/i.test(match[1])]);
        scripts++;
      }
    }
  }
  return scripts;
}

if (Number(process.versions.node.split('.')[0]) < 22) failures.push('Use Node.js 22 or later.');
const packageData = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(packageData.version)) failures.push('package.json needs a three-part release version.');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== 'v' + packageData.version) failures.push('Release tag does not match package.json.');
const files = await runtimeFiles(root);
updateConfig(JSON.parse(await readFile(path.join(root, 'updates-config.json'), 'utf8')));
if (process.argv.includes('--installer')) createOperatorAuth(JSON.parse(await readFile(path.join(root, 'operator-auth.json'), 'utf8')));
const scripts = await scan(root);
const ownerRoot = path.join(root, '..', 'PrintsMen Licence Manager');
let ownerScripts = 0;
try { ownerScripts = await scan(ownerRoot); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await Promise.all(Array.from({length:4}, async () => {
  while (syntaxJobs.length) await checkSyntax(...syntaxJobs.shift());
}));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Preflight passed: ${files.length} runtime files, ${scripts + ownerScripts} scripts, version ${packageData.version}, ${((Date.now() - started) / 1000).toFixed(1)} seconds.`);
