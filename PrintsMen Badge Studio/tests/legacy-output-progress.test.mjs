import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');

test('legacy production catalog keeps every output button and shared progress hook', () => {
  const html = read('printsmen/index.html');
  const ui = read('printsmen/printsmen-ui.js');
  const css = read('printsmen/printsmen-ui.css');
  const outputIds = [
    'exportBtn','exportBtn2','exportBtn3','exportBtn4','exportBtn5','exportBtn6','exportBtn7','exportBtn8','exportBtn9','exportBtn10','exportBtn11','exportBtn13',
    'p14ExportBtn','p15ExportPng','p15ExportPdf','p15ExportTiff','p16ExportZip','p17ExportJpg','p18ExportPdf','p19Export','p20ExportPng','p20ExportPdf','p21ExportPdf'
  ];
  for(const id of outputIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(html, new RegExp(`class=["'][^"']*export-btn[^"']*["'][^>]*id=["']${id}["']|id=["']${id}["'][^>]*class=["'][^"']*export-btn`));
  }
  assert.match(ui, /printsmenOutputProgress/);
  assert.match(ui, /closest\('\.page \.export-btn'\)/);
  assert.match(ui, /window\.showToast = function/);
  assert.match(css, /\.studio-output-status/);
});

test('production home catalog opts into lightweight card rendering', () => {
  const html = read('printsmen/index.html');
  const css = read('printsmen/printsmen-ui.css');
  assert.equal((html.match(/class="home-card"/g) || []).length, 20);
  assert.match(css, /body\.studio-home \.home-card\s*\{[^}]*contain:layout paint/s);
  assert.match(css, /body\.studio-home \.frame\s*\{[^}]*backdrop-filter:none/s);
});
