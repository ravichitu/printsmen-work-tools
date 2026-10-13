import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {makeOperatorConfig, createOperatorAuth} from '../licensing/operator-auth.mjs';
import {configureCiPreview} from '../scripts/configure-ci-preview.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'printsmen-ci-preview-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  return root;
}

test('CI preview configuration retains a working login and strips unrelated secret fields', async t => {
  const root = await fixture(t);
  const config = await makeOperatorConfig('test-user', 'test-password-only');
  await configureCiPreview({root, configText:JSON.stringify({...config, privateKey:'must-not-be-copied'})});
  const text = await readFile(path.join(root, 'operator-auth.json'), 'utf8');
  assert(!text.includes('test-password-only'));
  assert(!text.includes('privateKey'));
  const auth = createOperatorAuth(JSON.parse(text));
  const response = {setHeader(){}};
  const req = {headers:{}, socket:{remoteAddress:'127.0.0.1'}};
  assert.equal((await auth.login(req, response, {username:'test-user', password:'test-password-only'})).ok, true);
});

test('CI preview setup rejects missing, invalid and non-preview credentials before writing', async t => {
  const root = await fixture(t);
  await assert.rejects(configureCiPreview({root}), /PRINTSMEN_OPERATOR_CONFIG/);
  await assert.rejects(configureCiPreview({root, configText:'{}'}), /not configured/);
  const config = await makeOperatorConfig('test-user', 'test-password-only');
  await assert.rejects(configureCiPreview({root, configText:JSON.stringify({...config, temporary:false})}), /temporary/);
  await assert.rejects(readFile(path.join(root, 'operator-auth.json')), {code:'ENOENT'});
});

test('CI preview setup cannot replace an existing operator configuration', async t => {
  const root = await fixture(t);
  const first = JSON.stringify(await makeOperatorConfig('first-user', 'test-password-only'));
  await configureCiPreview({root, configText:first});
  const original = await readFile(path.join(root, 'operator-auth.json'), 'utf8');
  const second = JSON.stringify(await makeOperatorConfig('second-user', 'other-test-password'));
  await assert.rejects(configureCiPreview({root, configText:second}), {code:'EEXIST'});
  assert.equal(await readFile(path.join(root, 'operator-auth.json'), 'utf8'), original);
});
